import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { ensureAdminUser } from '../src/lib/auth.ts';
import type { AppEnv } from '../src/env.ts';

function createD1Adapter(sqliteDb: DatabaseSync): D1Database {
  function createPreparedStatement(sql: string, params: any[] = []): D1PreparedStatement {
    return {
      bind(...values: any[]) {
        return createPreparedStatement(sql, values);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = sqliteDb.prepare(sql);
        const row = stmt.get(...params);
        if (!row) return null;
        if (colName) return (row as any)[colName] ?? null;
        return row as T;
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        const stmt = sqliteDb.prepare(sql);
        const results = stmt.all(...params) as T[];
        return {
          results,
          success: true,
          meta: {} as any,
        };
      },
      async run(): Promise<D1Response> {
        const stmt = sqliteDb.prepare(sql);
        const res = stmt.run(...params);
        return {
          success: true,
          meta: { changes: res.changes } as any,
        };
      },
      raw<T = unknown>(): Promise<T[]> {
        throw new Error('Not implemented');
      },
    };
  }

  return {
    prepare(query: string): D1PreparedStatement {
      return createPreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      sqliteDb.exec('BEGIN TRANSACTION;');
      try {
        const results = [];
        for (const s of statements) {
          const res = await s.run();
          results.push({ results: [], success: true, meta: res.meta } as any);
        }
        sqliteDb.exec('COMMIT;');
        return results;
      } catch (err) {
        sqliteDb.exec('ROLLBACK;');
        throw err;
      }
    },
    async exec(query: string): Promise<D1ExecResult> {
      sqliteDb.exec(query);
      return { count: 0, duration: 0 };
    },
    dump(): Promise<ArrayBuffer> {
      throw new Error('Not implemented');
    },
  };
}

describe('Gidfine Cloudflare Worker End-to-End API Integration', () => {
  let sqlite: DatabaseSync;
  let env: AppEnv;
  const JWT_SECRET = 'super-secret-test-key-at-least-32-chars-long!';

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    // Apply all forward migrations in order
    const migrationsDir = path.resolve(import.meta.dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      sqlite.exec(sql);
    }

    env = {
      DB: createD1Adapter(sqlite),
      APP_NAME: 'Gidfine',
      APP_ENV: 'development',
      ALLOWED_ORIGINS: 'http://localhost:5173,https://loan-engine.pages.dev',
      ACCESS_TOKEN_TTL_SECONDS: '900',
      JWT_SIGNING_KEY: JWT_SECRET,
      ADMIN_EMAIL: 'admin@gidfine.com',
      ADMIN_PASSWORD: 'SecureAdminPassword123!',
    };

    // Ensure admin user is seeded for each in-memory test database
    await ensureAdminUser(env);
  });

  it('Test 1: Health endpoint returns 200 without authentication', async () => {
    const request = new Request('https://loan-engine.pages.dev/health', {
      method: 'GET',
    });
    const response = await worker.fetch(request, env);
    assert.strictEqual(response.status, 200);

    const json = (await response.json()) as any;
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.data.service, 'Gidfine');
    assert.strictEqual(json.data.environment, 'development');
    assert.strictEqual(json.data.database, 'ok');
    assert.ok(json.data.time);
  });

  it('Test 2: Borrower Registration, Login, and Auth Token Lifecycle', async () => {
    // 1. Self-service registration
    const regReq = new Request('https://loan-engine.pages.dev/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'kwame.borrower@example.com',
        password: 'ValidPassword123!',
        fullName: 'Kwame Mensah',
        phone: '+233201234567',
        agencySlug: 'gidfine',
      }),
    });
    const regRes = await worker.fetch(regReq, env);
    assert.strictEqual(regRes.status, 201);
    const regJson = (await regRes.json()) as any;
    assert.strictEqual(regJson.ok, true);
    const regData = regJson.data;
    assert.ok(regData.token, 'Should issue JWT token');
    assert.strictEqual(regData.user.email, 'kwame.borrower@example.com');
    assert.strictEqual(regData.user.role, 'borrower');
    assert.strictEqual(regData.user.agencyId, 'agency_default');

    // 2. Login with correct password
    const loginReq = new Request('https://loan-engine.pages.dev/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'kwame.borrower@example.com',
        password: 'ValidPassword123!',
      }),
    });
    const loginRes = await worker.fetch(loginReq, env);
    assert.strictEqual(loginRes.status, 200);
    const loginJson = (await loginRes.json()) as any;
    assert.strictEqual(loginJson.ok, true);
    const loginData = loginJson.data;
    assert.ok(loginData.token);
    assert.strictEqual(loginData.user.email, 'kwame.borrower@example.com');

    // 3. Login with incorrect password returns 401
    const badLoginReq = new Request('https://loan-engine.pages.dev/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'kwame.borrower@example.com',
        password: 'WrongPassword!',
      }),
    });
    const badLoginRes = await worker.fetch(badLoginReq, env);
    assert.strictEqual(badLoginRes.status, 401);

    // 4. GET /auth/me returns profile for valid token
    const meReq = new Request('https://loan-engine.pages.dev/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    const meRes = await worker.fetch(meReq, env);
    assert.strictEqual(meRes.status, 200);
    const meJson = (await meRes.json()) as any;
    assert.strictEqual(meJson.ok, true);
    assert.strictEqual(meJson.data.user.email, 'kwame.borrower@example.com');
    assert.strictEqual(meJson.data.user.role, 'borrower');

    // 5. GET /auth/me with invalid token returns 401
    const invalidReq = new Request('https://loan-engine.pages.dev/auth/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid.tampered.token' },
    });
    const invalidRes = await worker.fetch(invalidReq, env);
    assert.strictEqual(invalidRes.status, 401);
  });

  it('Test 3: Application Submission and Pesewas Integrity', async () => {
    // Register borrower
    const regReq = new Request('https://loan-engine.pages.dev/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ama.borrower@example.com',
        password: 'ValidPassword123!',
        fullName: 'Ama Serwaa',
        agencySlug: 'gidfine',
      }),
    });
    const regRes = await worker.fetch(regReq, env);
    const { token } = ((await regRes.json()) as any).data;

    // Submit initial application
    const appReq = new Request('https://loan-engine.pages.dev/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requestedAmountPesewas: 750000, // GH₵ 7,500.00
        tenureMonths: 12,
        purpose: 'Inventory purchase for trading shop',
      }),
    });

    const appRes = await worker.fetch(appReq, env);
    assert.strictEqual(appRes.status, 201);
    const appJson = (await appRes.json()) as any;
    assert.strictEqual(appJson.ok, true);
    const appData = appJson.data;
    assert.ok(appData.id);
    assert.strictEqual(appData.status, 'SUBMITTED');
    assert.strictEqual(appData.requestedAmountPesewas, 750000);
    assert.strictEqual(appData.tenureMonths, 12);

    // Verify row count in database
    const countRow = sqlite.prepare('SELECT COUNT(*) as count FROM loan_applications').get() as any;
    assert.strictEqual(countRow.count, 1);
  });

  it('Test 4: Idempotency Key Replay and Duplicate Suppression', async () => {
    // Register borrower
    const regReq = new Request('https://loan-engine.pages.dev/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'idemp.borrower@example.com',
        password: 'ValidPassword123!',
        fullName: 'Idemp Borrower',
        agencySlug: 'gidfine',
      }),
    });
    const regRes = await worker.fetch(regReq, env);
    const { token } = ((await regRes.json()) as any).data;

    const idempotencyKey = 'idemp_test_borrower_01';

    // Submit initial application
    const appReq = new Request('https://loan-engine.pages.dev/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        requestedAmountPesewas: 500000,
        tenureMonths: 6,
        purpose: 'Testing Idempotency Replay',
      }),
    });

    const appRes = await worker.fetch(appReq, env);
    assert.strictEqual(appRes.status, 201);
    const appData = ((await appRes.json()) as any).data;

    // Retry identical submission with the same idempotency key
    const retryReq = new Request('https://loan-engine.pages.dev/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        requestedAmountPesewas: 500000,
        tenureMonths: 6,
        purpose: 'Testing Idempotency Replay',
      }),
    });

    const retryRes = await worker.fetch(retryReq, env);
    assert.strictEqual(retryRes.status, 200, 'Replay should succeed with 200');
    const retryData = ((await retryRes.json()) as any).data;
    assert.strictEqual(retryData.id, appData.id, 'Must return identical application ID');

    // Confirm no duplicate application was inserted
    const countAfter = sqlite.prepare('SELECT COUNT(*) as count FROM loan_applications WHERE borrower_id = ?').get(appData.borrowerId) as any;
    assert.strictEqual(countAfter.count, 1, 'Duplicate row MUST NOT be created');
  });

  it('Test 5: Application Ownership Scoping and Borrower Isolation', async () => {
    // 1. Register Borrower 1
    const b1Reg = await worker.fetch(
      new Request('https://loan-engine.pages.dev/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'b1_iso@example.com',
          password: 'Password123!',
          fullName: 'Borrower One Iso',
          agencySlug: 'gidfine',
        }),
      }),
      env,
    );
    const { token: b1Token } = ((await b1Reg.json()) as any).data;

    // 2. Register Borrower 2
    const b2Reg = await worker.fetch(
      new Request('https://loan-engine.pages.dev/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'b2_iso@example.com',
          password: 'Password123!',
          fullName: 'Borrower Two Iso',
          agencySlug: 'gidfine',
        }),
      }),
      env,
    );
    const { token: b2Token } = ((await b2Reg.json()) as any).data;

    // 3. Borrower 1 submits an application
    const b1App = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${b1Token}`,
        },
        body: JSON.stringify({
          requestedAmountPesewas: 300000,
          tenureMonths: 6,
          purpose: 'Small machinery',
        }),
      }),
      env,
    );
    assert.strictEqual(b1App.status, 201);
    const b1AppData = ((await b1App.json()) as any).data;

    // 4. Borrower 1 queries their list -> sees their application
    const b1List = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'GET',
        headers: { Authorization: `Bearer ${b1Token}` },
      }),
      env,
    );
    const b1ListData = ((await b1List.json()) as any).data;
    assert.strictEqual(b1ListData.applications.length, 1);
    assert.strictEqual(b1ListData.applications[0].id, b1AppData.id);

    // 5. Borrower 2 queries their list -> sees 0 applications (isolated!)
    const b2List = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'GET',
        headers: { Authorization: `Bearer ${b2Token}` },
      }),
      env,
    );
    const b2ListData = ((await b2List.json()) as any).data;
    assert.strictEqual(b2ListData.applications.length, 0, 'Borrower 2 must not see Borrower 1 data');
  });

  it('Test 6: Platform Admin Queue Visibility and Tenant Isolation', async () => {
    // 1. Borrower submits application
    const bReg = await worker.fetch(
      new Request('https://loan-engine.pages.dev/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'b_queue@example.com',
          password: 'Password123!',
          fullName: 'Borrower Queue Test',
          agencySlug: 'gidfine',
        }),
      }),
      env,
    );
    const { token: bToken } = ((await bReg.json()) as any).data;

    const bApp = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bToken}`,
        },
        body: JSON.stringify({
          requestedAmountPesewas: 450000,
          tenureMonths: 12,
          purpose: 'Working Capital',
        }),
      }),
      env,
    );
    const bAppData = ((await bApp.json()) as any).data;

    // 2. Platform Admin queries agency queue
    const adminLogin = await worker.fetch(
      new Request('https://loan-engine.pages.dev/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@gidfine.com',
          password: 'SecureAdminPassword123!',
        }),
      }),
      env,
    );
    assert.strictEqual(adminLogin.status, 200);
    const { token: adminToken } = ((await adminLogin.json()) as any).data;

    const adminQueue = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      env,
    );
    assert.strictEqual(adminQueue.status, 200);
    const queueData = ((await adminQueue.json()) as any).data;
    assert.ok(queueData.applications.length >= 1);
    const found = queueData.applications.some((a: any) => a.id === bAppData.id);
    assert.strictEqual(found, true, 'Admin queue must include submitted application');
  });

  it('Test 7: Role Protection & Gated Execution', async () => {
    // Admin attempts to submit borrower application -> must fail with 403 Forbidden
    const adminLogin = await worker.fetch(
      new Request('https://loan-engine.pages.dev/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@gidfine.com',
          password: 'SecureAdminPassword123!',
        }),
      }),
      env,
    );
    assert.strictEqual(adminLogin.status, 200);
    const { token: adminToken } = ((await adminLogin.json()) as any).data;

    const invalidRoleSub = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          requestedAmountPesewas: 100000,
          tenureMonths: 12,
        }),
      }),
      env,
    );
    assert.strictEqual(invalidRoleSub.status, 403, 'Non-borrowers cannot submit applications');

    // Unauthenticated access to /applications -> 401
    const unauthReq = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'GET',
      }),
      env,
    );
    assert.strictEqual(unauthReq.status, 401);
  });
});
