import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { ensureAdminUser, hashPassword, signAccessToken } from '../src/lib/auth.ts';
import { decryptNationalId } from '../src/lib/encryption.ts';
import type { AppEnv } from '../src/env.ts';
import { ulid } from '../src/lib/ids.ts';

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

describe('Sprint 2 Origination Review, Security Remediation & Borrower Profile Workflow', () => {
  let sqlite: DatabaseSync;
  let env: AppEnv;
  const JWT_SECRET = 'super-secret-test-key-at-least-32-chars-long!';
  const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');

    // Apply all forward migrations in order (0001, 0002, 0003)
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
      ID_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
      ADMIN_EMAIL: 'admin@gidfine.com',
      ADMIN_PASSWORD: 'SecureAdminPassword123!',
    };

    await ensureAdminUser(env);
  });

  async function createTestBorrower(email: string, fullName = 'Test Borrower') {
    const regReq = new Request('https://loan-engine.pages.dev/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'ValidPassword123!',
        fullName,
        agencySlug: 'gidfine',
      }),
    });
    const regRes = await worker.fetch(regReq, env);
    assert.strictEqual(regRes.status, 201);
    const json = (await regRes.json()) as any;
    return { token: json.data.token, user: json.data.user };
  }

  async function createStaffUser(email: string, role: string, agencyId = 'agency_default') {
    const agencyExists = sqlite.prepare('SELECT id FROM agencies WHERE id = ?').get(agencyId);
    if (!agencyExists) {
      sqlite
        .prepare('INSERT INTO agencies (id, slug, name, created_at) VALUES (?, ?, ?, ?)')
        .run(agencyId, agencyId, agencyId, Date.now());
    }

    const userId = ulid();
    const hash = await hashPassword('ValidPassword123!');
    sqlite
      .prepare(
        `INSERT INTO users (id, agency_id, role, email, phone, full_name, password_hash, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, 1, ?, ?)`
      )
      .run(userId, agencyId, role, email, 'Staff User', hash, Date.now(), Date.now());

    const token = await signAccessToken(
      { userId, agencyId, role: role as any },
      env.JWT_SIGNING_KEY,
      900,
    );

    return { token, user: { id: userId, email, role, agencyId } };
  }

  it('verifies migration compatibility with existing records and table schemas', async () => {
    // Check loan_applications columns
    const cols = sqlite.prepare("PRAGMA table_info('loan_applications')").all() as any[];
    assert.ok(cols.some((c) => c.name === 'rejection_reason'));

    // Check application_notes table
    const notesCols = sqlite.prepare("PRAGMA table_info('application_notes')").all() as any[];
    assert.ok(notesCols.length > 0);

    // Check borrower_profiles table has encryption columns
    const profileCols = sqlite.prepare("PRAGMA table_info('borrower_profiles')").all() as any[];
    assert.ok(profileCols.some((c) => c.name === 'id_number_ciphertext'));
    assert.ok(profileCols.some((c) => c.name === 'id_number_iv'));
    assert.ok(profileCols.some((c) => c.name === 'id_number_tag'));
    assert.ok(profileCols.some((c) => c.name === 'id_number_masked'));

    // Check borrower_responses table exists
    const respCols = sqlite.prepare("PRAGMA table_info('borrower_responses')").all() as any[];
    assert.ok(respCols.length > 0);
  });

  it('encrypts National ID at rest using AES-256-GCM and never exposes plaintext in responses or DB', async () => {
    const borrower = await createTestBorrower('borrower_enc@test.com');
    const rawNationalId = 'GHA-987654321-0';

    // PUT profile with sensitive National ID
    const putRes = await worker.fetch(
      new Request('https://loan-engine.pages.dev/borrower/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${borrower.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nationalIdNumber: rawNationalId,
          nationalIdType: 'GHANA_CARD',
          monthlySalaryPesewas: 600000,
          employerName: 'Accra Port Authority',
          residentialAddress: 'Harbor Road 5, Tema',
        }),
      }),
      env,
    );
    assert.strictEqual(putRes.status, 200);
    const putJson = ((await putRes.json()) as any).data;

    // 1. Verify response NEVER exposes plaintext ID number
    assert.strictEqual(putJson.idNumber, undefined);
    assert.strictEqual(putJson.profile.idNumber, undefined);
    assert.strictEqual(putJson.idNumberMasked, 'GH****-0');
    assert.strictEqual(putJson.profile.national_id_number, 'GH****-0');

    // 2. Verify database record: id_number plaintext must be NULL, ciphertext must be populated
    const dbRow = sqlite
      .prepare('SELECT * FROM borrower_profiles WHERE user_id = ?')
      .get(borrower.user.id) as any;

    assert.strictEqual(dbRow.id_number, null, 'Plaintext id_number MUST be NULL in DB');
    assert.ok(dbRow.id_number_ciphertext, 'Ciphertext must be present');
    assert.ok(dbRow.id_number_iv, 'IV must be present');
    assert.ok(dbRow.id_number_tag, 'Auth tag must be present');
    assert.strictEqual(dbRow.id_number_masked, 'GH****-0');

    // 3. Verify server-side authenticated decryption with valid key succeeds
    const decrypted = await decryptNationalId(
      {
        ciphertext: dbRow.id_number_ciphertext,
        iv: dbRow.id_number_iv,
        tag: dbRow.id_number_tag,
      },
      TEST_ENCRYPTION_KEY,
    );
    assert.strictEqual(decrypted, rawNationalId);

    // 4. Verify GET /borrower/profile also returns strictly masked values
    const getRes = await worker.fetch(
      new Request('https://loan-engine.pages.dev/borrower/profile', {
        headers: { Authorization: `Bearer ${borrower.token}` },
      }),
      env,
    );
    assert.strictEqual(getRes.status, 200);
    const getJson = ((await getRes.json()) as any).data;
    assert.strictEqual(getJson.idNumber, undefined);
    assert.strictEqual(getJson.profile.idNumber, undefined);
    assert.strictEqual(getJson.idNumberMasked, 'GH****-0');
  });

  it('fails closed when decryption key is incorrect or ciphertext is modified', async () => {
    const borrower = await createTestBorrower('borrower_failclosed@test.com');
    const rawNationalId = 'GHA-112233445-5';

    await worker.fetch(
      new Request('https://loan-engine.pages.dev/borrower/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${borrower.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nationalIdNumber: rawNationalId,
          nationalIdType: 'GHANA_CARD',
        }),
      }),
      env,
    );

    const dbRow = sqlite
      .prepare('SELECT * FROM borrower_profiles WHERE user_id = ?')
      .get(borrower.user.id) as any;

    // Wrong decryption key -> must throw
    const WRONG_KEY = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    await assert.rejects(
      async () => {
        await decryptNationalId(
          {
            ciphertext: dbRow.id_number_ciphertext,
            iv: dbRow.id_number_iv,
            tag: dbRow.id_number_tag,
          },
          WRONG_KEY,
        );
      },
      /Authenticated decryption failed/,
    );

    // Tampered ciphertext with correct key -> must throw (fail closed)
    const tamperedCiphertext =
      dbRow.id_number_ciphertext.slice(0, -2) + (dbRow.id_number_ciphertext.endsWith('00') ? 'ff' : '00');
    await assert.rejects(
      async () => {
        await decryptNationalId(
          {
            ciphertext: tamperedCiphertext,
            iv: dbRow.id_number_iv,
            tag: dbRow.id_number_tag,
          },
          TEST_ENCRYPTION_KEY,
        );
      },
      /Authenticated decryption failed/,
    );
  });

  it('excludes plaintext National ID from audit events and error traces', async () => {
    const borrower = await createTestBorrower('borrower_audit_sec@test.com');
    const rawNationalId = 'GHA-778899001-1';

    await worker.fetch(
      new Request('https://loan-engine.pages.dev/borrower/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${borrower.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nationalIdNumber: rawNationalId,
          nationalIdType: 'GHANA_CARD',
          monthlySalaryPesewas: 350000,
        }),
      }),
      env,
    );

    // Inspect all audit events for this borrower
    const auditLogs = sqlite
      .prepare('SELECT * FROM audit_events WHERE actor_id = ?')
      .all(borrower.user.id) as any[];

    for (const log of auditLogs) {
      assert.strictEqual(
        log.details?.includes(rawNationalId),
        false,
        'Audit log details MUST NOT contain plaintext National ID',
      );
      assert.strictEqual(
        log.details?.includes('350000'),
        false,
        'Audit log details MUST NOT contain plain salary',
      );
    }
  });

  it('preserves backward compatibility with legacy unencrypted profile records', async () => {
    const borrower = await createTestBorrower('borrower_legacy@test.com');
    const profileId = ulid();

    // Directly insert legacy unencrypted row
    sqlite
      .prepare(
        `INSERT INTO borrower_profiles
           (id, agency_id, user_id, date_of_birth, id_type, id_number,
            id_number_ciphertext, id_number_iv, id_number_tag, id_number_key_version, id_number_masked,
            employer, monthly_salary_pesewas, city, created_at, updated_at)
         VALUES (?, ?, ?, '1990-05-15', 'PASSPORT', 'G1234567', NULL, NULL, NULL, 1, NULL, 'Legacy Employer', 400000, 'Kumasi', ?, ?)`
      )
      .run(profileId, borrower.user.agencyId, borrower.user.id, Date.now(), Date.now());

    // GET profile must succeed and return masked ID without leaking plaintext
    const getRes = await worker.fetch(
      new Request('https://loan-engine.pages.dev/borrower/profile', {
        headers: { Authorization: `Bearer ${borrower.token}` },
      }),
      env,
    );
    assert.strictEqual(getRes.status, 200);
    const getData = ((await getRes.json()) as any).data;
    assert.strictEqual(getData.idNumber, undefined);
    assert.strictEqual(getData.idNumberMasked, 'G1****67');
    assert.strictEqual(getData.employer, 'Legacy Employer');
  });

  it('rejects client-supplied booleans and requires server-verifiable borrower response evidence for MORE_INFO_REQUIRED -> UNDER_REVIEW', async () => {
    const agencyAdmin = await createStaffUser('staff_resp_audit@test.com', 'agency_admin');
    const borrower = await createTestBorrower('applicant_resp_audit@test.com');

    // 1. Borrower submits application
    const appRes = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${borrower.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedAmountPesewas: 500000,
          tenureMonths: 12,
          purpose: 'Inventory purchase',
        }),
      }),
      env,
    );
    const appId = ((await appRes.json()) as any).data.id;

    // 2. Staff: SUBMITTED -> UNDER_REVIEW
    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agencyAdmin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toStatus: 'UNDER_REVIEW' }),
      }),
      env,
    );

    // 3. Staff: UNDER_REVIEW -> MORE_INFO_REQUIRED
    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agencyAdmin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toStatus: 'MORE_INFO_REQUIRED',
          note: 'Please provide certified copy of business registration certificate.',
        }),
      }),
      env,
    );

    // 4. Client attempts to forge hasBorrowerResponse boolean in body -> MUST FAIL (400)
    const forgedAttempt = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agencyAdmin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toStatus: 'UNDER_REVIEW',
          hasBorrowerResponse: true,
          hasResponse: true,
          note: 'Trying to bypass with forged client boolean',
        }),
      }),
      env,
    );
    assert.strictEqual(forgedAttempt.status, 400);
    const forgedJson = (await forgedAttempt.json()) as any;
    assert.strictEqual(forgedJson.error.code, 'BORROWER_RESPONSE_REQUIRED');

    // 5. Authenticated borrower submits verified response evidence
    const borrowerSubmitResp = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/response`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${borrower.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          response: 'Business registration certificate attached (RGD-2024-8891). Verified by registrar.',
        }),
      }),
      env,
    );
    assert.strictEqual(borrowerSubmitResp.status, 201);
    const respJson = ((await borrowerSubmitResp.json()) as any).data;
    assert.strictEqual(respJson.applicationId, appId);
    assert.strictEqual(respJson.borrowerId, borrower.user.id);

    // 6. Transition to UNDER_REVIEW now succeeds with verified database evidence
    const validTransition = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agencyAdmin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toStatus: 'UNDER_REVIEW',
          note: 'Verified certificate against registrar portal.',
        }),
      }),
      env,
    );
    assert.strictEqual(validTransition.status, 200);
    const validJson = ((await validTransition.json()) as any).data;
    assert.strictEqual(validJson.application.status, 'UNDER_REVIEW');
  });

  it('rejects stale or unrelated borrower response evidence', async () => {
    const agencyAdmin = await createStaffUser('staff_stale@test.com', 'agency_admin');
    const borrower = await createTestBorrower('applicant_stale@test.com');

    // Submit and put into MORE_INFO_REQUIRED
    const appRes = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${borrower.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedAmountPesewas: 300000,
          tenureMonths: 6,
          purpose: 'Equipment',
        }),
      }),
      env,
    );
    const appId = ((await appRes.json()) as any).data.id;

    // Transition: SUBMITTED -> UNDER_REVIEW -> MORE_INFO_REQUIRED
    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agencyAdmin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'UNDER_REVIEW' }),
      }),
      env,
    );
    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agencyAdmin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'MORE_INFO_REQUIRED', note: 'First info request' }),
      }),
      env,
    );

    // Borrower submits response
    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/response`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${borrower.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: 'First response evidence' }),
      }),
      env,
    );

    // Transition back to UNDER_REVIEW
    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agencyAdmin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'UNDER_REVIEW' }),
      }),
      env,
    );

    // Staff now issues a SECOND MORE_INFO_REQUIRED request with a higher timestamp
    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agencyAdmin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'MORE_INFO_REQUIRED', note: 'Second info request (clarification)' }),
      }),
      env,
    );

    // Attempting to transition to UNDER_REVIEW relying on the OLD first response -> MUST FAIL (stale evidence)
    const staleAttempt = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agencyAdmin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'UNDER_REVIEW' }),
      }),
      env,
    );
    assert.strictEqual(staleAttempt.status, 400);
    const staleJson = (await staleAttempt.json()) as any;
    assert.strictEqual(staleJson.error.code, 'BORROWER_RESPONSE_REQUIRED');
  });

  it('rejects cross-user and cross-agency response evidence', async () => {
    const agency1Admin = await createStaffUser('admin_cross1@test.com', 'agency_admin', 'agency_01');
    const borrower1 = await createTestBorrower('borrower_cross1@test.com');
    const borrower2 = await createTestBorrower('borrower_cross2@test.com');

    // Borrower 1 submits application in agency_default
    const appRes = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${borrower1.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedAmountPesewas: 250000,
          tenureMonths: 6,
          purpose: 'Cross-evidence test',
        }),
      }),
      env,
    );
    const appId = ((await appRes.json()) as any).data.id;

    // Move to MORE_INFO_REQUIRED
    const staff = await createStaffUser('staff_agency_def@test.com', 'agency_admin', 'agency_default');
    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staff.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'UNDER_REVIEW' }),
      }),
      env,
    );
    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staff.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'MORE_INFO_REQUIRED', note: 'Provide documents' }),
      }),
      env,
    );

    // Borrower 2 attempts to submit a response for Borrower 1's application -> MUST FAIL (404 Not Found)
    const crossBorrowerResp = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/response`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${borrower2.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: 'Illegal attempt by borrower 2' }),
      }),
      env,
    );
    assert.strictEqual(crossBorrowerResp.status, 404);

    // Cross-agency staff attempts to view or transition -> MUST FAIL (404)
    const crossAgencyTransition = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agency1Admin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'UNDER_REVIEW' }),
      }),
      env,
    );
    assert.strictEqual(crossAgencyTransition.status, 404);
  });

  it('enforces mandatory rejection reason when transitioning to AGENCY_REJECTED', async () => {
    const agencyAdmin = await createStaffUser('staff_rej@test.com', 'agency_admin');
    const borrower = await createTestBorrower('applicant_rej@test.com');

    const appRes = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${borrower.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedAmountPesewas: 300000,
          tenureMonths: 6,
          purpose: 'Equipment',
        }),
      }),
      env,
    );
    const appId = ((await appRes.json()) as any).data.id;

    await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agencyAdmin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toStatus: 'UNDER_REVIEW' }),
      }),
      env,
    );

    // Reject without reason -> Expect 400 REJECTION_REASON_REQUIRED
    const rejFail = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agencyAdmin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toStatus: 'AGENCY_REJECTED',
          rejectionReason: '',
        }),
      }),
      env,
    );
    assert.strictEqual(rejFail.status, 400);
    const rejFailJson = (await rejFail.json()) as any;
    assert.strictEqual(rejFailJson.error.code, 'REJECTION_REASON_REQUIRED');

    // Reject with proper reason -> Expect 200
    const rejPass = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agencyAdmin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toStatus: 'AGENCY_REJECTED',
          rejectionReason: 'Debt-to-income ratio exceeds regulatory threshold (50%).',
        }),
      }),
      env,
    );
    assert.strictEqual(rejPass.status, 200);
    const rejPassJson = ((await rejPass.json()) as any).data;
    assert.strictEqual(rejPassJson.application.status, 'AGENCY_REJECTED');
    assert.strictEqual(
      rejPassJson.application.rejection_reason,
      'Debt-to-income ratio exceeds regulatory threshold (50%).',
    );
  });

  it('enforces borrower cancellation ownership and prohibits staff or other borrowers from cancelling without ownership', async () => {
    const borrower1 = await createTestBorrower('borrower_own1@test.com');
    const borrower2 = await createTestBorrower('borrower_own2@test.com');

    const appRes = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${borrower1.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedAmountPesewas: 200000,
          tenureMonths: 12,
          purpose: 'Education',
        }),
      }),
      env,
    );
    const appId = ((await appRes.json()) as any).data.id;

    // Borrower 2 attempts to cancel Borrower 1's application -> Expect 404 (isolated tenant/user)
    const cancelOther = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${borrower2.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toStatus: 'CANCELLED' }),
      }),
      env,
    );
    assert.strictEqual(cancelOther.status, 404);

    // Borrower 1 cancels their own application -> Expect 200
    const cancelOwn = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${borrower1.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toStatus: 'CANCELLED' }),
      }),
      env,
    );
    assert.strictEqual(cancelOwn.status, 200);
    const cancelOwnJson = ((await cancelOwn.json()) as any).data;
    assert.strictEqual(cancelOwnJson.application.status, 'CANCELLED');
  });

  it('restricts internal notes to agency staff and returns 403 Forbidden to borrowers', async () => {
    const agencyAdmin = await createStaffUser('staff_notes@test.com', 'agency_admin');
    const borrower = await createTestBorrower('borrower_notes_acc@test.com');

    const appRes = await worker.fetch(
      new Request('https://loan-engine.pages.dev/applications', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${borrower.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedAmountPesewas: 100000,
          tenureMonths: 6,
          purpose: 'Health',
        }),
      }),
      env,
    );
    const appId = ((await appRes.json()) as any).data.id;

    // Agency staff creates a note
    const postNote = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agencyAdmin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note: 'Bank statement verified via API. Employer active.',
        }),
      }),
      env,
    );
    assert.strictEqual(postNote.status, 201);
    const noteJson = ((await postNote.json()) as any).data;
    assert.strictEqual(noteJson.note.note, 'Bank statement verified via API. Employer active.');

    // Agency staff reads notes
    const getNotesStaff = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/notes`, {
        headers: { Authorization: `Bearer ${agencyAdmin.token}` },
      }),
      env,
    );
    assert.strictEqual(getNotesStaff.status, 200);
    const notesStaffJson = ((await getNotesStaff.json()) as any).data;
    assert.strictEqual(notesStaffJson.notes.length, 1);
    assert.strictEqual(notesStaffJson.notes[0].author_name, 'Staff User');

    // Borrower attempts to read internal notes -> Expect 403 Forbidden
    const getNotesBorrower = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/notes`, {
        headers: { Authorization: `Bearer ${borrower.token}` },
      }),
      env,
    );
    assert.strictEqual(getNotesBorrower.status, 403);

    // Borrower attempts to post an internal note -> Expect 403 Forbidden
    const postNoteBorrower = await worker.fetch(
      new Request(`https://loan-engine.pages.dev/applications/${appId}/notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${borrower.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Attempting borrower note injection' }),
      }),
      env,
    );
    assert.strictEqual(postNoteBorrower.status, 403);
  });
});
