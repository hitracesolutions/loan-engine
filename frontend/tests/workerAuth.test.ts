import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import worker from "../../backend/src/index.ts";
import { createSqliteD1Adapter } from "../../backend/src/db/sqliteD1Adapter.ts";
import { hashPassword, verifyPassword, TEST_PBKDF2_ITERATIONS } from "../../backend/src/auth/password.ts";
import { serializeSessionCookie, parseSessionCookie, hashToken, SESSION_COOKIE_NAME } from "../../backend/src/auth/session.ts";
import { requireRole, assertTenantIsolation } from "../../backend/src/middleware/auth.ts";
import type { Env, AuthContext } from "../../backend/src/types.ts";

describe("Cloudflare Workers Custom Authentication & Session Lifecycle (Phase 2 Slice A)", () => {
  let sqliteDb: DatabaseSync;
  let env: Env;

  beforeEach(async () => {
    sqliteDb = new DatabaseSync(":memory:");
    sqliteDb.exec("PRAGMA foreign_keys = ON;");

    const migrationPath = path.resolve(import.meta.dirname, "../../migrations/0001_initial_d1_schema.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");
    sqliteDb.exec(migrationSql);

    const d1Adapter = createSqliteD1Adapter(sqliteDb);
    env = {
      DB: d1Adapter,
      APP_ENV: "test",
    };

    // Seed test agency and test users with fast iteration hashing for testing
    const now = Date.now();
    sqliteDb.prepare(`
      INSERT INTO agencies (id, name, code, status, created_at)
      VALUES ('agency_accra', 'Accra Central Agency', 'ACC01', 'active', ?);
    `).run(now);

    sqliteDb.prepare(`
      INSERT INTO agencies (id, name, code, status, created_at)
      VALUES ('agency_kumasi', 'Kumasi North Agency', 'KUM01', 'active', ?);
    `).run(now);

    const passwordHash = await hashPassword("ValidPassword123!", TEST_PBKDF2_ITERATIONS);

    sqliteDb.prepare(`
      INSERT INTO users (id, agency_id, role, email, password_hash, name, status, created_at, updated_at)
      VALUES ('user_cashier', 'agency_accra', 'cashier', 'cashier@gidfine.com', ?, 'Kofi Cashier', 'active', ?, ?);
    `).run(passwordHash, now, now);

    sqliteDb.prepare(`
      INSERT INTO users (id, agency_id, role, email, password_hash, name, status, created_at, updated_at)
      VALUES ('user_admin', 'agency_accra', 'agency_admin', 'admin@gidfine.com', ?, 'Kwame Admin', 'active', ?, ?);
    `).run(passwordHash, now, now);

    sqliteDb.prepare(`
      INSERT INTO users (id, agency_id, role, email, password_hash, name, status, created_at, updated_at)
      VALUES ('user_kumasi_officer', 'agency_kumasi', 'loan_officer', 'officer@kumasi.com', ?, 'Ama Officer', 'active', ?, ?);
    `).run(passwordHash, now, now);

    sqliteDb.prepare(`
      INSERT INTO users (id, agency_id, role, email, password_hash, name, status, created_at, updated_at)
      VALUES ('user_suspended', 'agency_accra', 'borrower', 'suspended@gidfine.com', ?, 'Suspended User', 'suspended', ?, ?);
    `).run(passwordHash, now, now);
  });

  describe("Password Hashing & Constant-Time Verification", () => {
    it("hashes and verifies plaintext passwords correctly using WebCrypto PBKDF2", async () => {
      const plain = "SuperSecretPassword99!";
      const hash = await hashPassword(plain, TEST_PBKDF2_ITERATIONS);

      assert.strictEqual(hash.startsWith("pbkdf2_sha256$1000$"), true);

      const isValid = await verifyPassword(plain, hash);
      assert.strictEqual(isValid, true);

      const isInvalid = await verifyPassword("WrongPassword123", hash);
      assert.strictEqual(isInvalid, false);
    });

    it("safely handles malformed password hashes without throwing", async () => {
      assert.strictEqual(await verifyPassword("password", "invalid_format"), false);
      assert.strictEqual(await verifyPassword("password", "pbkdf2_sha256$notanumber$salt$hash"), false);
      assert.strictEqual(await verifyPassword("password", null as any), false);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("authenticates valid credentials, sets HttpOnly cookie, and returns sanitized profile", async () => {
      const req = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "cashier@gidfine.com",
          password: "ValidPassword123!",
        }),
      });

      const res = await worker.fetch(req, env);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.user.email, "cashier@gidfine.com");
      assert.strictEqual(body.user.role, "cashier");
      assert.strictEqual(body.user.agencyId, "agency_accra");
      assert.strictEqual(body.user.password_hash, undefined); // Password hash must NEVER leak

      // Verify Set-Cookie header
      const setCookie = res.headers.get("Set-Cookie");
      assert.ok(setCookie);
      assert.ok(setCookie.includes("gidfine_session="));
      assert.ok(setCookie.includes("HttpOnly"));
      assert.ok(setCookie.includes("SameSite=Strict"));

      // Verify that only the SHA-256 token hash was stored in D1
      const rawToken = parseSessionCookie(setCookie);
      assert.ok(rawToken);
      const expectedHash = await hashToken(rawToken);

      const sessionRow = sqliteDb.prepare("SELECT * FROM user_sessions WHERE id = ?").get(expectedHash) as any;
      assert.ok(sessionRow);
      assert.strictEqual(sessionRow.user_id, "user_cashier");
      assert.strictEqual(sessionRow.agency_id, "agency_accra");

      // Verify rawToken itself is NOT in the database
      const rawInDb = sqliteDb.prepare("SELECT * FROM user_sessions WHERE id = ?").get(rawToken);
      assert.strictEqual(rawInDb, undefined);
    });

    it("rejects invalid password and increments failed login attempts", async () => {
      const req = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "cashier@gidfine.com",
          password: "WrongPassword!",
        }),
      });

      const res = await worker.fetch(req, env);
      assert.strictEqual(res.status, 401);

      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error, "Invalid email or password");

      const user = sqliteDb.prepare("SELECT failed_login_attempts FROM users WHERE id = 'user_cashier'").get() as any;
      assert.strictEqual(user.failed_login_attempts, 1);
    });

    it("locks user account after 5 consecutive failed login attempts", async () => {
      for (let i = 0; i < 5; i++) {
        const req = new Request("http://localhost/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "cashier@gidfine.com",
            password: "WrongPassword!",
          }),
        });
        await worker.fetch(req, env);
      }

      // 6th attempt should return 423 Locked
      const req = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "cashier@gidfine.com",
          password: "ValidPassword123!",
        }),
      });
      const res = await worker.fetch(req, env);
      assert.strictEqual(res.status, 423);

      const body = await res.json();
      assert.strictEqual(body.code, "ACCOUNT_LOCKED");
    });

    it("rejects suspended or non-existent accounts with generic errors", async () => {
      // Non-existent
      const req1 = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ghost@gidfine.com", password: "somepassword" }),
      });
      const res1 = await worker.fetch(req1, env);
      assert.strictEqual(res1.status, 401);

      // Suspended
      const req2 = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "suspended@gidfine.com", password: "ValidPassword123!" }),
      });
      const res2 = await worker.fetch(req2, env);
      assert.strictEqual(res2.status, 403);
    });

    it("rejects malformed requests and oversized payloads", async () => {
      const req = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json",
      });
      const res = await worker.fetch(req, env);
      assert.strictEqual(res.status, 400);
    });
  });

  describe("GET /api/v1/auth/me & Session Resolution", () => {
    it("resolves authenticated user, agency, and role exclusively from valid server-side session", async () => {
      // First log in to obtain valid cookie
      const loginReq = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@gidfine.com", password: "ValidPassword123!" }),
      });
      const loginRes = await worker.fetch(loginReq, env);
      const cookie = loginRes.headers.get("Set-Cookie")!;

      // Call /me with the cookie
      const meReq = new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: { Cookie: cookie },
      });
      const meRes = await worker.fetch(meReq, env);
      assert.strictEqual(meRes.status, 200);

      const body = await meRes.json();
      assert.strictEqual(body.user.email, "admin@gidfine.com");
      assert.strictEqual(body.user.role, "agency_admin");
      assert.strictEqual(body.agency.id, "agency_accra");
    });

    it("rejects unauthenticated requests without cookie", async () => {
      const meReq = new Request("http://localhost/api/v1/auth/me", { method: "GET" });
      const meRes = await worker.fetch(meReq, env);
      assert.strictEqual(meRes.status, 401);
    });

    it("rejects expired sessions and cleans up session record", async () => {
      // Insert already expired session in D1
      const rawToken = "expired_raw_token_12345678901234567890";
      const tokenHash = await hashToken(rawToken);
      const past = Date.now() - 10000;

      sqliteDb.prepare(`
        INSERT INTO user_sessions (id, user_id, agency_id, expires_at, created_at, last_active_at)
        VALUES (?, 'user_cashier', 'agency_accra', ?, ?, ?);
      `).run(tokenHash, past, past, past);

      const req = new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${rawToken}` },
      });

      const res = await worker.fetch(req, env);
      assert.strictEqual(res.status, 401);

      // Expired session should have been deleted
      const inDb = sqliteDb.prepare("SELECT * FROM user_sessions WHERE id = ?").get(tokenHash);
      assert.strictEqual(inDb, undefined);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("revokes session in database and issues clearing cookie", async () => {
      // 1. Log in
      const loginReq = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "cashier@gidfine.com", password: "ValidPassword123!" }),
      });
      const loginRes = await worker.fetch(loginReq, env);
      const cookie = loginRes.headers.get("Set-Cookie")!;
      const rawToken = parseSessionCookie(cookie)!;
      const tokenHash = await hashToken(rawToken);

      // Verify session exists
      assert.ok(sqliteDb.prepare("SELECT * FROM user_sessions WHERE id = ?").get(tokenHash));

      // 2. Log out
      const logoutReq = new Request("http://localhost/api/v1/auth/logout", {
        method: "POST",
        headers: { Cookie: cookie },
      });
      const logoutRes = await worker.fetch(logoutReq, env);
      assert.strictEqual(logoutRes.status, 200);

      // Verify clear cookie header
      const clearCookie = logoutRes.headers.get("Set-Cookie");
      assert.ok(clearCookie);
      assert.ok(clearCookie.includes("Max-Age=0"));

      // Verify session row was deleted
      assert.strictEqual(sqliteDb.prepare("SELECT * FROM user_sessions WHERE id = ?").get(tokenHash), undefined);

      // 3. /me should now fail
      const meReq = new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: { Cookie: cookie },
      });
      const meRes = await worker.fetch(meReq, env);
      assert.strictEqual(meRes.status, 401);
    });
  });

  describe("Tenant Isolation & Role Authorization Middleware", () => {
    it("strictly prevents cross-agency access", () => {
      const accraContext: AuthContext = {
        user: { id: "u1", agency_id: "agency_accra", role: "cashier" } as any,
        agency: { id: "agency_accra" } as any,
        session: { id: "s1" } as any,
      };

      // Allowed within same agency
      assert.doesNotThrow(() => assertTenantIsolation(accraContext, "agency_accra"));

      // Forbidden across different agency
      assert.throws(
        () => assertTenantIsolation(accraContext, "agency_kumasi"),
        /Cross-agency access attempt rejected/
      );
    });

    it("strictly enforces role authorization", () => {
      const cashierContext: AuthContext = {
        user: { id: "u1", agency_id: "agency_accra", role: "cashier" } as any,
        agency: { id: "agency_accra" } as any,
        session: { id: "s1" } as any,
      };

      // Cashier is allowed for cashier role
      assert.doesNotThrow(() => requireRole(cashierContext, ["cashier", "agency_admin"]));

      // Cashier is rejected for underwriter role
      assert.throws(
        () => requireRole(cashierContext, ["underwriter", "agency_admin"]),
        /FORBIDDEN: Operation requires one of/
      );
    });
  });
});
