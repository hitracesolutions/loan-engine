import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { ensureAdminUser } from '../src/lib/auth.ts';
import type { AppEnv } from '../src/env.ts';

type SqliteValue = null | number | bigint | string | NodeJS.ArrayBufferView;

function notImplementedRaw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
function notImplementedRaw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
function notImplementedRaw<T = unknown[]>(
  _options?: { columnNames?: boolean },
): Promise<T[] | [string[], ...T[]]> {
  throw new Error('Not implemented');
}

function createD1Adapter(sqliteDb: DatabaseSync): D1Database {
  function testMeta(changes = 0): D1Meta & Record<string, unknown> {
    return {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: changes,
      last_row_id: 0,
      changed_db: changes > 0,
      changes,
    };
  }

  function createPreparedStatement(sql: string, params: SqliteValue[] = []): D1PreparedStatement {
    return {
      bind(...values: SqliteValue[]) {
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
        return { results, success: true, meta: testMeta() };
      },
      async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const stmt = sqliteDb.prepare(sql);
        const res = stmt.run(...params);
        return { results: [], success: true, meta: testMeta(Number(res.changes)) };
      },
      raw: notImplementedRaw,
    };
  }

  const prepare = (query: string): D1PreparedStatement => createPreparedStatement(query);

  const batch = async <T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> => {
    sqliteDb.exec('BEGIN TRANSACTION;');
    try {
      const results: D1Result<T>[] = [];
      for (const s of statements) {
        const res = await s.run();
        results.push({ results: [], success: true, meta: res.meta });
      }
      sqliteDb.exec('COMMIT;');
      return results;
    } catch (err) {
      sqliteDb.exec('ROLLBACK;');
      throw err;
    }
  };

  const exec = async (query: string): Promise<D1ExecResult> => {
    sqliteDb.exec(query);
    return { count: 0, duration: 0 };
  };

  return {
    prepare,
    batch,
    exec,
    dump(): Promise<ArrayBuffer> {
      throw new Error('Not implemented');
    },
    withSession(): D1DatabaseSession {
      return { prepare, batch, getBookmark: () => null };
    },
  };
}

function decodeClaims(token: string): Record<string, unknown> {
  const [, encodedPayload] = token.split('.');
  const normalized = encodedPayload!.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

describe('Administrator impersonation', () => {
  let sqlite: DatabaseSync;
  let env: AppEnv;
  let adminToken: string;
  let adminUserId: string;

  const ADMIN_EMAIL = 'admin@gidfine.com';
  const ADMIN_PASSWORD = 'SecureAdminPassword123!';

  type TestResponse = { status: number; body: any };

  async function call(
    method: string,
    pathname: string,
    options: { token?: string; body?: unknown } = {},
  ): Promise<TestResponse> {
    const headers: Record<string, string> = {};
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.body !== undefined) headers['content-type'] = 'application/json';

    const response = await worker.fetch(
      new Request(`https://loan-engine.pages.dev${pathname}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      }),
      env,
    );
    return { status: response.status, body: await response.json().catch(() => null) };
  }

  async function registerBorrower(email: string) {
    const res = await call('POST', '/auth/register', {
      body: { email, password: 'BorrowerPassword123!', fullName: 'Test Borrower' },
    });
    assert.strictEqual(res.status, 201, `register failed: ${JSON.stringify(res.body)}`);
    return { token: res.body.token as string, userId: res.body.user.id as string };
  }

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    const migrationsDir = path.resolve(import.meta.dirname, '../migrations');
    for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
      sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }

    env = {
      DB: createD1Adapter(sqlite),
      APP_NAME: 'Gidfine',
      APP_ENV: 'development',
      ALLOWED_ORIGINS: 'http://localhost:5173',
      ACCESS_TOKEN_TTL_SECONDS: '900',
      JWT_SIGNING_KEY: 'super-secret-test-key-at-least-32-chars-long!',
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
    };

    await ensureAdminUser(env);

    const login = await call('POST', '/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    assert.strictEqual(login.status, 200, `admin login failed: ${JSON.stringify(login.body)}`);
    adminToken = login.body.token as string;
    adminUserId = login.body.user.id as string;
  });

  it('issues a read-only session token that acts as the target user', async () => {
    const borrower = await registerBorrower('borrower@example.com');

    const started = await call('POST', '/admin/impersonate', {
      token: adminToken,
      body: { userId: borrower.userId },
    });
    assert.strictEqual(started.status, 200, JSON.stringify(started.body));
    const impersonationId = started.body.impersonation.id as string;
    assert.ok(impersonationId);
    assert.strictEqual(started.body.impersonation.impersonatedBy, adminUserId);
    assert.strictEqual(started.body.impersonation.targetUser.role, 'borrower');

    const claims = decodeClaims(started.body.token as string);
    assert.strictEqual(claims.sub, borrower.userId);
    assert.strictEqual(claims.act, adminUserId);
    assert.strictEqual(claims.imp, impersonationId);
    assert.strictEqual(claims.role, 'borrower');

    // The token really is the borrower for authorisation purposes.
    const me = await call('GET', '/auth/me', { token: started.body.token });
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.body.user.id, borrower.userId);
  });

  it('allows reads but rejects every state-changing request', async () => {
    const borrower = await registerBorrower('borrower2@example.com');
    const started = await call('POST', '/admin/impersonate', {
      token: adminToken,
      body: { userId: borrower.userId },
    });
    const impersonationToken = started.body.token as string;

    const read = await call('GET', '/applications', { token: impersonationToken });
    assert.strictEqual(read.status, 200, JSON.stringify(read.body));

    const write = await call('POST', '/applications', {
      token: impersonationToken,
      body: { requestedAmountPesewas: 100000, tenureMonths: 6 },
    });
    assert.strictEqual(write.status, 403);
    assert.match(String(write.body?.error?.message ?? ''), /read-only/i);
  });

  it('cannot mint a second impersonation from an impersonated session', async () => {
    const borrower = await registerBorrower('borrower3@example.com');
    const other = await registerBorrower('borrower4@example.com');
    const started = await call('POST', '/admin/impersonate', {
      token: adminToken,
      body: { userId: borrower.userId },
    });

    const nested = await call('POST', '/admin/impersonate', {
      token: started.body.token,
      body: { userId: other.userId },
    });
    assert.strictEqual(nested.status, 403);
  });

  it('only an administrator may impersonate', async () => {
    const borrower = await registerBorrower('borrower5@example.com');
    const victim = await registerBorrower('borrower6@example.com');

    const attempt = await call('POST', '/admin/impersonate', {
      token: borrower.token,
      body: { userId: victim.userId },
    });
    assert.strictEqual(attempt.status, 403);
  });

  it('rejects impersonating another administrator', async () => {
    const borrower = await registerBorrower('borrower7@example.com');
    sqlite.prepare("UPDATE users SET role = 'agency_admin' WHERE id = ?").run(borrower.userId);

    const attempt = await call('POST', '/admin/impersonate', {
      token: adminToken,
      body: { userId: borrower.userId },
    });
    assert.strictEqual(attempt.status, 403);
    assert.match(String(attempt.body?.error?.message ?? ''), /administrators/i);
  });

  it('rejects unknown, disabled and self targets', async () => {
    const borrower = await registerBorrower('borrower8@example.com');

    const unknown = await call('POST', '/admin/impersonate', {
      token: adminToken,
      body: { userId: 'does_not_exist' },
    });
    assert.strictEqual(unknown.status, 404);

    sqlite.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(borrower.userId);
    const disabled = await call('POST', '/admin/impersonate', {
      token: adminToken,
      body: { userId: borrower.userId },
    });
    assert.strictEqual(disabled.status, 400);
    sqlite.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(borrower.userId);

    const self = await call('POST', '/admin/impersonate', {
      token: adminToken,
      body: { userId: adminUserId },
    });
    assert.strictEqual(self.status, 400);
  });

  it('revokes the token when the session is stopped', async () => {
    const borrower = await registerBorrower('borrower9@example.com');
    const started = await call('POST', '/admin/impersonate', {
      token: adminToken,
      body: { userId: borrower.userId },
    });
    const impersonationToken = started.body.token as string;

    const before = await call('GET', '/auth/me', { token: impersonationToken });
    assert.strictEqual(before.status, 200);

    const stop = await call('POST', '/admin/impersonate/stop', { token: impersonationToken });
    assert.strictEqual(stop.status, 200, JSON.stringify(stop.body));
    assert.strictEqual(stop.body.stopped, true);

    const after = await call('GET', '/auth/me', { token: impersonationToken });
    assert.strictEqual(after.status, 401);
  });

  it('records start and stop events in the security audit log', async () => {
    const borrower = await registerBorrower('borrower10@example.com');
    const started = await call('POST', '/admin/impersonate', {
      token: adminToken,
      body: { userId: borrower.userId },
    });
    await call('POST', '/admin/impersonate/stop', { token: started.body.token });

    const events = sqlite
      .prepare("SELECT event_type, user_id, details FROM security_audit_logs WHERE event_type LIKE 'IMPERSONATION_%' ORDER BY created_at")
      .all() as Array<{ event_type: string; user_id: string; details: string }>;

    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].event_type, 'IMPERSONATION_STARTED');
    assert.strictEqual(events[0].user_id, adminUserId);
    const startDetails = JSON.parse(events[0].details);
    assert.strictEqual(startDetails.targetUserId, borrower.userId);
    assert.strictEqual(startDetails.impersonationId, started.body.impersonation.id);

    assert.strictEqual(events[1].event_type, 'IMPERSONATION_STOPPED');
    const stopDetails = JSON.parse(events[1].details);
    assert.strictEqual(stopDetails.impersonationId, started.body.impersonation.id);
  });

  it('lists impersonatable users for administrators only', async () => {
    const borrower = await registerBorrower('borrower11@example.com');

    const asAdmin = await call('GET', '/admin/users', { token: adminToken });
    assert.strictEqual(asAdmin.status, 200);
    const ids = (asAdmin.body.users as Array<{ id: string }>).map((u) => u.id);
    assert.ok(ids.includes(borrower.userId));
    assert.ok(!ids.includes(adminUserId), 'administrators must not appear as impersonation targets');

    const asBorrower = await call('GET', '/admin/users', { token: borrower.token });
    assert.strictEqual(asBorrower.status, 403);
  });
});
