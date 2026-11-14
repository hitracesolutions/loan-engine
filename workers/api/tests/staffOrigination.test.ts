import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { hashPassword, signAccessToken } from '../src/lib/auth.ts';
import type { AppEnv } from '../src/env.ts';

type SqlValue = null | number | bigint | string | NodeJS.ArrayBufferView;
function createD1Adapter(sqlite: DatabaseSync): D1Database {
  const meta = (changes = 0): D1Meta => ({ duration: 0, size_after: 0, rows_read: 0, rows_written: changes, last_row_id: 0, changed_db: changes > 0, changes });
  const statement = (sql: string, params: SqlValue[] = []): D1PreparedStatement => ({
    bind(...values: SqlValue[]) { return statement(sql, values); },
    async first<T = unknown>(column?: string) { const row = sqlite.prepare(sql).get(...params) as any; return (column ? row?.[column] : row) as T ?? null; },
    async all<T = unknown>() { return { results: sqlite.prepare(sql).all(...params) as T[], success: true, meta: meta() }; },
    async run<T = Record<string, unknown>>() { const result = sqlite.prepare(sql).run(...params); return { results: [], success: true, meta: meta(Number(result.changes)) }; },
    raw: async () => { throw new Error('Not implemented'); },
  });
  const prepare = (sql: string) => statement(sql);
  const batch = async <T = unknown>(statements: D1PreparedStatement[]) => {
    sqlite.exec('BEGIN');
    try { const result = []; for (const item of statements) { const value = await item.run(); result.push({ results: [], success: true, meta: value.meta }); } sqlite.exec('COMMIT'); return result as D1Result<T>[]; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  };
  return { prepare, batch, exec: async (sql) => { sqlite.exec(sql); return { count: 0, duration: 0 }; }, dump: async () => { throw new Error('Not implemented'); }, withSession: () => ({ prepare, batch, getBookmark: () => null }) };
}

describe('staff on-behalf origination', () => {
  let sqlite: DatabaseSync;
  let env: AppEnv;
  const tokens = new Map<string, string>();
  const secret = 'staff-origination-test-signing-key-at-least-32-chars';

  async function call(method: string, url: string, role?: string, body?: unknown, tokenOverride?: string) {
    const response = await worker.fetch(new Request(`https://loan-engine.pages.dev${url}`, {
      method,
      headers: { ...(role || tokenOverride ? { authorization: `Bearer ${tokenOverride ?? tokens.get(role!)}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    const payload = await response.json() as any;
    return { status: response.status, data: payload.data, error: payload.error };
  }

  async function createUser(role: string, email: string, agency = 'agency_default') {
    const id = `user_${role}_${email.split('@')[0]}`;
    const now = Date.now();
    sqlite.prepare('INSERT INTO users (id, agency_id, role, email, phone, full_name, password_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?, 1, ?, ?)')
      .run(id, agency, role, email, `User ${role}`, await hashPassword('TemporaryPassword123!'), now, now);
    tokens.set(role, await signAccessToken({ userId: id, agencyId: agency, role: role as any }, secret, 3600));
    return id;
  }
  const token = (role: string, _email: string) => tokens.get(role)!;
  const validApplication = (borrowerId: string, consent: unknown = { attested: true, method: 'in_branch' }) => ({ borrowerId, requestedAmountPesewas: 150000, tenureMonths: 6, purpose: 'School fees', consent });

  beforeEach(() => {
    tokens.clear();
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON');
    const dir = path.resolve(import.meta.dirname, '../migrations');
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) sqlite.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
    env = { DB: createD1Adapter(sqlite), APP_NAME: 'Gidfine', APP_ENV: 'development', ALLOWED_ORIGINS: 'http://localhost:5173', ACCESS_TOKEN_TTL_SECONDS: '900', JWT_SIGNING_KEY: secret };
  });

  it('registers borrowers for both allowed roles with agency scope, no token, and staff audit attribution', async () => {
    for (const role of ['loan_officer', 'agency_admin']) {
      const staffId = await createUser(role, `${role}@example.com`);
      const result = await call('POST', '/staff/borrowers', role, { email: `new-${role}@example.com`, password: 'TemporaryPassword123!', fullName: 'Ama Mensah', phone: '+233201234567' });
      assert.equal(result.status, 201);
      assert.equal(result.data.user.role, 'borrower');
      assert.equal(result.data.user.agencyId, 'agency_default');
      assert.equal('token' in result.data, false);
      const audit = sqlite.prepare("SELECT actor_id, resource_id FROM audit_events WHERE action='BORROWER_REGISTERED_BY_STAFF' AND resource_id=?").get(result.data.user.id) as any;
      assert.equal(audit.actor_id, staffId);
      assert.equal(audit.resource_id, result.data.user.id);
      const stored = sqlite.prepare('SELECT password_hash FROM users WHERE id=?').get(result.data.user.id) as any;
      assert.notEqual(stored.password_hash, 'TemporaryPassword123!');
    }
  });

  it('rejects disallowed roles and conflicts duplicate email within the staff agency', async () => {
    for (const role of ['borrower', 'cashier', 'underwriter', 'auditor', 'lender']) {
      const id = await createUser(role, `${role}@example.com`);
      const result = await call('POST', '/staff/borrowers', role, { email: `new-${role}@example.com`, password: 'TemporaryPassword123!', fullName: 'Ama Mensah' });
      assert.equal(result.status, 403);
      assert.equal(sqlite.prepare('SELECT count(*) AS count FROM users WHERE email=?').get(`new-${role}@example.com`)?.count, 0);
      assert.ok(id);
    }
    await createUser('loan_officer', 'officer@example.com');
    const existing = await createUser('borrower', 'duplicate@example.com');
    const duplicate = await call('POST', '/staff/borrowers', 'loan_officer', { email: 'DUPLICATE@example.com', password: 'TemporaryPassword123!', fullName: 'Ama Mensah' });
    assert.equal(duplicate.status, 409);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM users WHERE id=?').get(existing)?.count, 1);
  });

  it('creates submitted applications for active in-agency borrowers with actor-attributed audit and history', async () => {
    const staff = await createUser('loan_officer', 'officer@example.com');
    const borrowerId = await createUser('borrower', 'borrower@example.com');
    const created = await call('POST', '/staff/applications', 'loan_officer', validApplication(borrowerId));
    assert.equal(created.status, 201);
    const applicationId = created.data.id;
    assert.equal(created.data.borrowerId, borrowerId);
    assert.equal(created.data.status, 'SUBMITTED');
    const events = sqlite.prepare("SELECT actor_id, action, details FROM audit_events WHERE resource_id=? ORDER BY action").all(applicationId) as any[];
    assert.deepEqual(events.map((event) => event.action).sort(), ['APPLICATION_CREATED_ON_BEHALF', 'ON_BEHALF_CONSENT_ATTESTED']);
    for (const event of events) assert.equal(event.actor_id, staff);
    const consent = JSON.parse(events.find((event) => event.action === 'ON_BEHALF_CONSENT_ATTESTED').details);
    assert.equal(consent.method, 'in_branch');
    const history = sqlite.prepare('SELECT actor_id, to_status FROM application_status_history WHERE application_id=?').get(applicationId) as any;
    assert.equal(history.actor_id, staff);
    assert.equal(history.to_status, 'SUBMITTED');
    const queue = await call('GET', '/applications', 'loan_officer', undefined, token('loan_officer', 'officer@example.com'));
    assert.equal(queue.status, 200);
    assert.ok(queue.data.applications.some((app: any) => app.id === applicationId));
    const borrowerQueue = await call('GET', '/borrower/applications', 'borrower', undefined, await signAccessToken({ userId: borrowerId, agencyId: 'agency_default', role: 'borrower' }, secret, 3600));
    assert.equal(borrowerQueue.status, 200);
    assert.ok(JSON.stringify(borrowerQueue.data).includes(applicationId));
  });

  it('enforces staff role, agency and borrower identity checks', async () => {
    await createUser('loan_officer', 'officer@example.com');
    const other = await createUser('borrower', 'other@example.com', 'agency_default');
    const unknown = await call('POST', '/staff/applications', 'loan_officer', validApplication('missing-user'));
    assert.equal(unknown.status, 404);
    const anotherRole = await call('POST', '/staff/applications', 'borrower', validApplication(other));
    assert.equal(anotherRole.status, 403);
    await sqlite.prepare("INSERT INTO agencies (id, slug, name, created_at) VALUES ('agency_other','other','Other',?)").run(Date.now());
    const foreign = await createUser('borrower', 'foreign@example.com', 'agency_other');
    assert.equal((await call('POST', '/staff/applications', 'loan_officer', validApplication(foreign))).status, 404);
    const underwriter = await createUser('underwriter', 'underwriter@example.com');
    assert.equal((await call('POST', '/staff/applications', 'loan_officer', validApplication(underwriter))).status, 404);
    const inactive = await createUser('borrower', 'inactive@example.com');
    sqlite.prepare('UPDATE users SET is_active=0 WHERE id=?').run(inactive);
    assert.equal((await call('POST', '/staff/applications', 'loan_officer', validApplication(inactive))).status, 400);
  });

  it('requires explicit valid consent before writing an application', async () => {
    await createUser('loan_officer', 'officer@example.com');
    const borrower = await createUser('borrower', 'borrower@example.com');
    for (const consent of [null, { attested: false, method: 'phone' }]) {
      const result = await call('POST', '/staff/applications', 'loan_officer', validApplication(borrower, consent));
      assert.equal(result.status, 400);
      assert.equal(result.error.code, 'CONSENT_REQUIRED');
    }
    const invalid = await call('POST', '/staff/applications', 'loan_officer', validApplication(borrower, { attested: true, method: 'sms' }));
    assert.equal(invalid.status, 400);
    assert.equal(invalid.error.code, 'CONSENT_METHOD_INVALID');
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM loan_applications').get()?.count, 0);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM audit_events WHERE action='ON_BEHALF_CONSENT_ATTESTED'").get()?.count, 0);
  });

  it('rejects an impersonated admin token on both mutation endpoints', async () => {
    const admin = await createUser('agency_admin', 'admin@example.com');
    const borrower = await createUser('borrower', 'borrower@example.com');
    const impersonated = await signAccessToken({ userId: admin, agencyId: 'agency_default', role: 'agency_admin', impersonatedBy: 'root-admin', impersonationId: 'test-session' }, secret, 3600);
    const borrowerAttempt = await call('POST', '/staff/borrowers', undefined, { email: 'impersonated@example.com', password: 'TemporaryPassword123!', fullName: 'Ama Mensah' }, impersonated);
    assert.equal(borrowerAttempt.status, 403);
    assert.match(borrowerAttempt.error.message, /read-only/i);
    const appAttempt = await call('POST', '/staff/applications', undefined, validApplication(borrower), impersonated);
    assert.equal(appAttempt.status, 403);
    assert.match(appAttempt.error.message, /read-only/i);
  });
});
