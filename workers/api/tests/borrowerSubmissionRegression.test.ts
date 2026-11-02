import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { ensureAdminUser, hashPassword, signAccessToken } from '../src/lib/auth.ts';
import type { AppEnv } from '../src/env.ts';
import { ulid } from '../src/lib/ids.ts';

function createD1Adapter(sqliteDb: DatabaseSync, shouldFailBatch = false): D1Database {
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
      if (shouldFailBatch) {
        throw new Error('D1_SIMULATED_FAILURE: table loan_applications lock timeout');
      }
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

describe('Borrower Application Submission Remediation & Regression Suite', () => {
  let sqlite: DatabaseSync;
  let env: AppEnv;
  const JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-chars-long';
  const agencyId = 'agency_test_sub_01';
  let borrowerToken: string;
  let borrowerId: string;
  let lenderToken: string;

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');

    const migrationsDir = path.resolve(import.meta.dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
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
    } as AppEnv;

    await ensureAdminUser(env);

    const now = Date.now();
    sqlite
      .prepare('INSERT INTO agencies (id, slug, name, created_at) VALUES (?, ?, ?, ?)')
      .run(agencyId, 'test-agency', 'Test Agency', now);

    const passwordHash = await hashPassword('SecurePass123!');
    borrowerId = ulid(now);
    sqlite
      .prepare(
        `INSERT INTO users (id, agency_id, role, email, phone, full_name, password_hash, is_active, created_at, updated_at)
         VALUES (?, ?, 'borrower', ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(borrowerId, agencyId, 'borrower@example.com', '+233201234567', 'Kwame Mensah', passwordHash, now, now);

    borrowerToken = await signAccessToken(
      { userId: borrowerId, agencyId, role: 'borrower' },
      JWT_SECRET,
      3600,
    );

    const lenderId = ulid(now);
    sqlite
      .prepare(
        `INSERT INTO users (id, agency_id, role, email, phone, full_name, password_hash, is_active, created_at, updated_at)
         VALUES (?, ?, 'lender', ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(lenderId, agencyId, 'lender@example.com', '+233209876543', 'Accra Capital', passwordHash, now, now);

    lenderToken = await signAccessToken(
      { userId: lenderId, agencyId, role: 'lender' },
      JWT_SECRET,
      3600,
    );
  });

  it('1. Happy Path: Successful borrower submission creates record with rejection_reason=NULL, audit event and status history', async () => {
    const key = 'idemp_happy_001';
    const req = new Request('http://localhost/applications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${borrowerToken}`,
        'idempotency-key': key,
      },
      body: JSON.stringify({
        requestedAmountPesewas: 750000, // GH₵ 7,500.00
        tenureMonths: 12,
        purpose: 'Inventory purchase for trading store',
      }),
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 201, 'Should return HTTP 201 Created');

    const json = (await res.json()) as any;
    assert.equal(json.ok, true);
    assert.ok(json.data.id);
    assert.equal(json.data.status, 'SUBMITTED');
    assert.equal(json.data.requestedAmountPesewas, 750000);
    assert.equal(json.data.tenureMonths, 12);
    assert.equal(json.data.purpose, 'Inventory purchase for trading store');

    // Verify D1 database state
    const appRow = sqlite
      .prepare('SELECT * FROM loan_applications WHERE id = ?')
      .get(json.data.id) as any;
    assert.ok(appRow, 'Application row must exist in D1');
    assert.equal(appRow.status, 'SUBMITTED');
    assert.equal(appRow.requested_amount_pesewas, 750000);
    assert.equal(appRow.tenure_months, 12);
    assert.equal(appRow.rejection_reason, null, 'rejection_reason must be NULL upon submission');
    assert.ok(appRow.submitted_at > 0, 'submitted_at must be populated');

    // Verify audit log
    const auditRow = sqlite
      .prepare('SELECT * FROM audit_events WHERE resource_id = ? AND action = ?')
      .get(json.data.id, 'APPLICATION_SUBMITTED') as any;
    assert.ok(auditRow, 'Audit event APPLICATION_SUBMITTED must exist');
    assert.equal(auditRow.actor_id, borrowerId);

    // Verify application status history
    const historyRow = sqlite
      .prepare('SELECT * FROM application_status_history WHERE application_id = ?')
      .get(json.data.id) as any;
    assert.ok(historyRow, 'Status history row must exist');
    assert.equal(historyRow.to_status, 'SUBMITTED');
  });

  it('2. Invalid requested amount: Rejects non-positive, zero, float, or invalid amounts with 400 INVALID_AMOUNT', async () => {
    const invalidAmounts = [0, -1000, 500.5, 'five_thousand', null, undefined];

    for (const badAmount of invalidAmounts) {
      const req = new Request('http://localhost/applications', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${borrowerToken}`,
        },
        body: JSON.stringify({
          requestedAmountPesewas: badAmount,
          tenureMonths: 12,
        }),
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 400, `Amount ${badAmount} should return HTTP 400`);
      const json = (await res.json()) as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'INVALID_AMOUNT');
      assert.ok(
        json.error.message.includes('requestedAmountPesewas'),
        `Error message must name requestedAmountPesewas, got: ${json.error.message}`,
      );
    }
  });

  it('3. Invalid tenure: Rejects non-positive, zero, float, or invalid tenure with 400 INVALID_INTEGER', async () => {
    const invalidTenures = [0, -6, 12.5, 'twelve', null, undefined];

    for (const badTenure of invalidTenures) {
      const req = new Request('http://localhost/applications', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${borrowerToken}`,
        },
        body: JSON.stringify({
          requestedAmountPesewas: 500000,
          tenureMonths: badTenure,
        }),
      });

      const res = await worker.fetch(req, env);
      assert.equal(res.status, 400, `Tenure ${badTenure} should return HTTP 400`);
      const json = (await res.json()) as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'INVALID_INTEGER');
      assert.ok(
        json.error.message.includes('tenureMonths'),
        `Error message must name tenureMonths, got: ${json.error.message}`,
      );
    }
  });

  it('4. ADR-0005 Policy Compliance: Uncapped tenure and large amounts are permitted at origination', async () => {
    // Per ADR-0005: "Tenure: no cap. Tenure is configured per product and the validation rule must not impose a global maximum."
    // And principal limit is an open catalogue decision (R-1), not an origination gate.
    const req = new Request('http://localhost/applications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${borrowerToken}`,
      },
      body: JSON.stringify({
        requestedAmountPesewas: 25_000_000_00, // GH₵ 25,000,000.00
        tenureMonths: 600, // 50 years
        purpose: 'Long-term infrastructure project',
      }),
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 201, 'Uncapped tenure and large amounts must be accepted at origination per ADR-0005');
    const json = (await res.json()) as any;
    assert.equal(json.data.tenureMonths, 600);
    assert.equal(json.data.requestedAmountPesewas, 25_000_000_00);
  });

  it('5. Idempotency Replay: Retrying identical submission returns 200 OK without inserting duplicate rows', async () => {
    const key = 'idemp_replay_test_001';
    const payload = {
      requestedAmountPesewas: 1000000,
      tenureMonths: 24,
      purpose: 'Equipment purchase',
    };

    const makeReq = () =>
      new Request('http://localhost/applications', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${borrowerToken}`,
          'idempotency-key': key,
        },
        body: JSON.stringify(payload),
      });

    // First call -> 201 Created
    const res1 = await worker.fetch(makeReq(), env);
    assert.equal(res1.status, 201);
    const json1 = (await res1.json()) as any;

    const countBefore = sqlite.prepare('SELECT COUNT(*) as count FROM loan_applications').get() as any;
    assert.equal(countBefore.count, 1);

    // Second call -> 200 OK with cached response
    const res2 = await worker.fetch(makeReq(), env);
    assert.equal(res2.status, 200, 'Replayed submission must return HTTP 200 OK');
    const json2 = (await res2.json()) as any;
    assert.equal(json2.ok, true);
    assert.equal(json2.data.id, json1.data.id, 'Must return identical application ID');

    const countAfter = sqlite.prepare('SELECT COUNT(*) as count FROM loan_applications').get() as any;
    assert.equal(countAfter.count, 1, 'No duplicate record may be created');
  });

  it('6. Role Security: Rejects unauthenticated requests with 401 and non-borrower roles with 403', async () => {
    // 6a. Unauthenticated
    const unauthReq = new Request('http://localhost/applications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestedAmountPesewas: 500000, tenureMonths: 12 }),
    });
    const unauthRes = await worker.fetch(unauthReq, env);
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401');

    // 6b. Non-borrower role (e.g. lender)
    const lenderReq = new Request('http://localhost/applications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${lenderToken}`,
      },
      body: JSON.stringify({ requestedAmountPesewas: 500000, tenureMonths: 12 }),
    });
    const lenderRes = await worker.fetch(lenderReq, env);
    assert.equal(lenderRes.status, 403, 'Non-borrower must receive 403 Forbidden');
    const lenderJson = (await lenderRes.json()) as any;
    assert.equal(lenderJson.error.code, 'FORBIDDEN');
  });

  it('7. Simulated D1 Failure: Returns structured APPLICATION_CREATION_FAILED 500 without leaking raw SQL or sensitive info', async () => {
    const failingEnv = {
      ...env,
      DB: createD1Adapter(sqlite, true /* shouldFailBatch = true */),
    } as AppEnv;

    const req = new Request('http://localhost/applications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${borrowerToken}`,
      },
      body: JSON.stringify({
        requestedAmountPesewas: 600000,
        tenureMonths: 18,
        purpose: 'Agriculture equipment',
      }),
    });

    const res = await worker.fetch(req, failingEnv);
    assert.equal(res.status, 500, 'Batch database error must return HTTP 500');

    const json = (await res.json()) as any;
    assert.equal(json.ok, false);
    assert.equal(json.error.code, 'APPLICATION_CREATION_FAILED');
    assert.equal(json.error.message, 'Failed to create loan application due to a database error');
    assert.ok(
      !JSON.stringify(json).includes('D1_SIMULATED_FAILURE'),
      'Raw database exception must never leak to the client',
    );
    assert.ok(
      !JSON.stringify(json).includes('lock timeout'),
      'Raw database error details must never leak to the client',
    );
  });
});
