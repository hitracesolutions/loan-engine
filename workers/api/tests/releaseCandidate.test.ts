import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { ensureAdminUser, hashPassword, signAccessToken } from '../src/lib/auth.ts';
import { postJournalEntry } from '../src/domain/financialLedger.ts';
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

describe('Gidfine Release Candidate Critical Invariant Verification', () => {
  let sqlite: DatabaseSync;
  let env: AppEnv;
  const JWT_SECRET = 'super-secret-test-key-at-least-32-chars-long!';
  const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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
      ID_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
      ADMIN_EMAIL: 'admin@gidfine.com',
      ADMIN_PASSWORD: 'SecureAdminPassword123!',
    } as any;

    await ensureAdminUser(env);
  });

  async function createUser(email: string, role: string, agencyId = 'agency_default', fullName = 'Test User') {
    const id = ulid();
    const pwHash = await hashPassword('TestPassword123!');
    const now = Date.now();
    sqlite.prepare(
      `INSERT INTO users (id, agency_id, role, email, phone, full_name, password_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, '+233200000000', ?, ?, 1, ?, ?)`,
    ).run(id, agencyId, role, email.toLowerCase(), fullName, pwHash, now, now);

    const token = await signAccessToken(
      { userId: id, agencyId, role: role as any },
      JWT_SECRET,
      900,
    );
    return { id, email, token, role, agencyId };
  }

  // 1. FRESH MIGRATION & PROGRESSIVE UPGRADE TEST
  it('Migration Suite: Successfully applies 0001 through 0007 from fresh state and upgrades progressively', async () => {
    const freshDb = new DatabaseSync(':memory:');
    freshDb.exec('PRAGMA foreign_keys = ON;');

    const migrationsDir = path.resolve(import.meta.dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    // Step 1: Apply 0001 to 0003
    for (const file of files.filter((f) => f < '0004')) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      freshDb.exec(sql);
    }

    // Insert prerequisite user record for the seeded agency_default
    freshDb.prepare(
      `INSERT INTO users (id, agency_id, role, email, full_name, password_hash, created_at, updated_at)
       VALUES ('u_legacy', 'agency_default', 'borrower', 'legacy@test.com', 'Legacy User', 'hash', 1740000000000, 1740000000000)`,
    ).run();

    // Insert legacy profile record
    freshDb.prepare(
      `INSERT INTO borrower_profiles (id, agency_id, user_id, date_of_birth, id_type, id_number, monthly_salary_pesewas, created_at, updated_at)
       VALUES ('p_legacy', 'agency_default', 'u_legacy', '1985-05-15', 'PASSPORT', 'G1234567', 500000, 1740000000000, 1740000000000)`,
    ).run();

    // Step 2: Apply 0004 through 0007 (Progressive Upgrade)
    for (const file of files.filter((f) => f >= '0004')) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      freshDb.exec(sql);
    }

    // Verify existing record preserved
    const profile = freshDb.prepare(`SELECT * FROM borrower_profiles WHERE id = 'p_legacy'`).get() as any;
    assert.equal(profile.id_number, 'G1234567');
    assert.equal(profile.monthly_salary_pesewas, 500000);

    // Verify all new tables exist
    const tables = freshDb
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all()
      .map((t: any) => t.name);

    assert.ok(tables.includes('lenders'));
    assert.ok(tables.includes('lender_products'));
    assert.ok(tables.includes('quote_snapshots'));
    assert.ok(tables.includes('borrower_offers'));
    assert.ok(tables.includes('borrower_consents'));
    assert.ok(tables.includes('disbursement_records'));
    assert.ok(tables.includes('accounts'));
    assert.ok(tables.includes('journal_entries'));
    assert.ok(tables.includes('journal_lines'));
    assert.ok(tables.includes('loans'));
    assert.ok(tables.includes('cashier_payments'));
    assert.ok(tables.includes('payment_reversals'));
    assert.ok(tables.includes('document_records'));
    assert.ok(tables.includes('outbox_events'));
    assert.ok(tables.includes('mfa_configurations'));
    assert.ok(tables.includes('security_audit_logs'));
  });

  // 2. FINANCIAL INVARIANTS: BALANCED JOURNAL & ATOMICITY
  it('Financial Invariants: Strict balanced double-entry check and rejection of unbalanced postings', async () => {
    const admin = await createUser('admin_fin@gidfine.com', 'agency_admin');

    // Unbalanced line attempt: Debit 1000, Credit 800 -> MUST THROW UNBALANCED_JOURNAL_ENTRY
    await assert.rejects(
      async () => {
        await postJournalEntry({
          db: env.DB,
          agencyId: 'agency_default',
          actorId: admin.id,
          description: 'Unbalanced test',
          reference: 'REF_UNBALANCED',
          lines: [
            { accountCode: '1010', debitPesewas: 1000, creditPesewas: 0 },
            { accountCode: '1200', debitPesewas: 0, creditPesewas: 800 },
          ],
        });
      },
      /UNBALANCED_JOURNAL_ENTRY/,
    );

    // Balanced line: Debit 1000, Credit 1000 -> SUCCEEDS
    const res = await postJournalEntry({
      db: env.DB,
      agencyId: 'agency_default',
      actorId: admin.id,
      description: 'Balanced test',
      reference: 'REF_BALANCED_1',
      lines: [
        { accountCode: '1010', debitPesewas: 1000, creditPesewas: 0 },
        { accountCode: '1200', debitPesewas: 0, creditPesewas: 1000 },
      ],
    });
    assert.ok(res.journalEntryId);
    assert.equal(res.totalPesewas, 1000);
  });

  // 3. FINANCIAL INVARIANTS: IDEMPOTENCY & REPEATED REVERSAL PREVENTION
  it('Financial Invariants: Rejects duplicate payment references and prevents repeated payment reversals', async () => {
    const cashier = await createUser('cashier_idem@gidfine.com', 'cashier');
    const admin = await createUser('admin_idem@gidfine.com', 'agency_admin');
    const borrower = await createUser('borrower_idem@gidfine.com', 'borrower');

    const loanId = ulid();
    const appId = ulid();
    const lenderId = ulid();
    const now = Date.now();

    sqlite.prepare(
      `INSERT INTO lenders (id, agency_id, name, slug, contact_email, status, created_at, updated_at)
       VALUES (?, 'agency_default', 'Lender Bank', 'lender-bank', 'lender@bank.com', 'ACTIVE', ?, ?)`,
    ).run(lenderId, now, now);

    sqlite.prepare(
      `INSERT INTO loan_applications (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, created_at, updated_at)
       VALUES (?, 'agency_default', ?, 'ACTIVE', 500000, 3, ?, ?)`,
    ).run(appId, borrower.id, now, now);

    const quoteId = ulid();
    sqlite.prepare(
      `INSERT INTO quote_snapshots (id, agency_id, application_id, calculation_strategy, principal_pesewas, total_interest_pesewas, total_fees_pesewas, total_repayable_pesewas, monthly_repayment_pesewas, schedule_json, is_simulation, status, snapshot_hash, created_at)
       VALUES (?, 'agency_default', ?, 'FLAT_SIMULATION', 500000, 30000, 20000, 550000, 183333, '[]', 1, 'ACCEPTED', 'hash1', ?)`,
    ).run(quoteId, appId, now);

    const offerId = ulid();
    sqlite.prepare(
      `INSERT INTO borrower_offers (id, agency_id, application_id, quote_snapshot_id, offered_amount_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas, status, expires_at, created_by, created_at)
       VALUES (?, 'agency_default', ?, ?, 500000, 2400, 3, 183333, 'ACCEPTED', ?, ?, ?)`,
    ).run(offerId, appId, quoteId, now + 86400000, admin.id, now);

    const disbId = ulid();
    sqlite.prepare(
      `INSERT INTO disbursement_records (id, agency_id, application_id, offer_id, amount_pesewas, channel, destination_account_masked, maker_id, checker_id, status, simulation_mode, reference, prepared_at)
       VALUES (?, 'agency_default', ?, ?, 500000, 'SIMULATED', 'MOMO', ?, ?, 'DISBURSED', 1, 'REF-D1', ?)`,
    ).run(disbId, appId, offerId, admin.id, cashier.id, now);

    sqlite.prepare(
      `INSERT INTO loans (
         id, agency_id, application_id, borrower_id, lender_id, disbursement_record_id,
         principal_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas,
         outstanding_principal_pesewas, outstanding_interest_pesewas, outstanding_fees_pesewas,
         status, disbursed_at, created_at, updated_at
       ) VALUES (?, 'agency_default', ?, ?, ?, ?, 500000, 2400, 3, 183333, 500000, 30000, 20000, 'ACTIVE', ?, ?, ?)`,
    ).run(loanId, appId, borrower.id, lenderId, disbId, now, now, now);

    // Initial Payment
    const payRes1 = await worker.fetch(
      new Request(`http://localhost/loans/${loanId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
        body: JSON.stringify({
          amountPesewas: 100000,
          paymentMethod: 'CASH',
          reference: 'UNIQUE-CASHIER-REF-001',
        }),
      }),
      env,
    );
    assert.equal(payRes1.status, 201);
    const payData1 = await payRes1.json() as any;
    const paymentId = payData1.data.paymentId;

    // DUPLICATE PAYMENT ATTEMPT: Same reference -> MUST FAIL WITH 409 CONFLICT
    const dupPayRes = await worker.fetch(
      new Request(`http://localhost/loans/${loanId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
        body: JSON.stringify({
          amountPesewas: 100000,
          paymentMethod: 'CASH',
          reference: 'UNIQUE-CASHIER-REF-001', // Identical reference
        }),
      }),
      env,
    );
    assert.equal(dupPayRes.status, 409);

    // REVERSAL 1: Admin reverses payment -> 200 OK
    const revRes1 = await worker.fetch(
      new Request(`http://localhost/payments/${paymentId}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
        body: JSON.stringify({ reason: 'Reversal request for wrong cashier entry' }),
      }),
      env,
    );
    assert.equal(revRes1.status, 200);

    // REVERSAL 2 (REPEATED ATTEMPT): Same payment already reversed -> MUST FAIL WITH 409 CONFLICT
    const dupRevRes = await worker.fetch(
      new Request(`http://localhost/payments/${paymentId}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
        body: JSON.stringify({ reason: 'Second reversal attempt' }),
      }),
      env,
    );
    assert.equal(dupRevRes.status, 409);
  });

  // 4. DUPLICATE DISBURSEMENT CONFIRMATION PREVENTION
  it('Disbursement Invariants: Rejects duplicate confirmation attempts on already disbursed loans', async () => {
    const officer = await createUser('officer_disb@gidfine.com', 'loan_officer');
    const cashier = await createUser('cashier_disb@gidfine.com', 'cashier');
    const borrower = await createUser('borrower_disb@gidfine.com', 'borrower');

    const appId = ulid();
    const now = Date.now();

    sqlite.prepare(
      `INSERT INTO loan_applications (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, created_at, updated_at)
       VALUES (?, 'agency_default', ?, 'BORROWER_ACCEPTED', 300000, 3, ?, ?)`,
    ).run(appId, borrower.id, now, now);

    const quoteId = ulid();
    sqlite.prepare(
      `INSERT INTO quote_snapshots (id, agency_id, application_id, calculation_strategy, principal_pesewas, total_interest_pesewas, total_fees_pesewas, total_repayable_pesewas, monthly_repayment_pesewas, schedule_json, is_simulation, status, snapshot_hash, created_at)
       VALUES (?, 'agency_default', ?, 'FLAT_SIMULATION', 300000, 18000, 10000, 328000, 109333, '[]', 1, 'ACCEPTED', 'hashD', ?)`,
    ).run(quoteId, appId, now);

    const offerId = ulid();
    sqlite.prepare(
      `INSERT INTO borrower_offers (id, agency_id, application_id, quote_snapshot_id, offered_amount_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas, status, expires_at, created_by, created_at)
       VALUES (?, 'agency_default', ?, ?, 300000, 2400, 3, 109333, 'ACCEPTED', ?, ?, ?)`,
    ).run(offerId, appId, quoteId, now + 86400000, officer.id, now);

    sqlite.prepare(
      `INSERT INTO borrower_consents (id, agency_id, application_id, offer_id, borrower_id, consent_text, terms_hash, created_at)
       VALUES (?, 'agency_default', ?, ?, ?, 'Agreed', 'hashConsent', ?)`,
    ).run(ulid(), appId, offerId, borrower.id, now);

    // Prepare Disbursement (Maker)
    const prepRes = await worker.fetch(
      new Request('http://localhost/disbursements/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${officer.token}` },
        body: JSON.stringify({
          applicationId: appId,
          channel: 'SIMULATED',
          destinationAccountMasked: 'MoMo 0240000000',
        }),
      }),
      env,
    );
    assert.equal(prepRes.status, 201);
    const disbData = await prepRes.json() as any;
    const disbId = disbData.data.disbursementId;

    // Confirm Disbursement 1 (Checker)
    const confRes1 = await worker.fetch(
      new Request('http://localhost/disbursements/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
        body: JSON.stringify({ disbursementId: disbId }),
      }),
      env,
    );
    assert.equal(confRes1.status, 200);

    // Duplicate Confirmation Attempt: MUST FAIL WITH 409 CONFLICT
    const dupConfRes = await worker.fetch(
      new Request('http://localhost/disbursements/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashier.token}` },
        body: JSON.stringify({ disbursementId: disbId }),
      }),
      env,
    );
    assert.equal(dupConfRes.status, 409);
  });

  // 5. TENANT ISOLATION & BORROWER OWNERSHIP
  it('Authorization & Isolation: Cross-agency access is denied and borrowers cannot access foreign offers or consent', async () => {
    // Tenant 1
    const borrowerA = await createUser('borrowerA@tenant1.com', 'borrower', 'agency_default');
    // Tenant 2
    sqlite.prepare(`INSERT INTO agencies (id, slug, name, created_at) VALUES ('agency_two', 'tenant2', 'Tenant 2', ?)`).run(Date.now());
    const borrowerB = await createUser('borrowerB@tenant2.com', 'borrower', 'agency_two');
    const officerB = await createUser('officerB@tenant2.com', 'loan_officer', 'agency_two');

    const appBId = ulid();
    const now = Date.now();
    sqlite.prepare(
      `INSERT INTO loan_applications (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, created_at, updated_at)
       VALUES (?, 'agency_two', ?, 'AGENCY_APPROVED', 400000, 3, ?, ?)`,
    ).run(appBId, borrowerB.id, now, now);

    const quoteId = ulid();
    sqlite.prepare(
      `INSERT INTO quote_snapshots (id, agency_id, application_id, calculation_strategy, principal_pesewas, total_interest_pesewas, total_fees_pesewas, total_repayable_pesewas, monthly_repayment_pesewas, schedule_json, is_simulation, status, snapshot_hash, created_at)
       VALUES (?, 'agency_two', ?, 'FLAT_SIMULATION', 400000, 24000, 10000, 434000, 144666, '[]', 1, 'OFFERED', 'hashX', ?)`,
    ).run(quoteId, appBId, now);

    const offerId = ulid();
    sqlite.prepare(
      `INSERT INTO borrower_offers (id, agency_id, application_id, quote_snapshot_id, offered_amount_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas, status, expires_at, created_by, created_at)
       VALUES (?, 'agency_two', ?, ?, 400000, 2400, 3, 144666, 'OFFERED', ?, ?, ?)`,
    ).run(offerId, appBId, quoteId, now + 86400000, officerB.id, now);

    // Borrower A (Tenant 1) attempts to fetch Tenant 2's offer -> 404 Not Found (Tenant Isolated)
    const crossTenantOffer = await worker.fetch(
      new Request(`http://localhost/applications/${appBId}/offer`, {
        headers: { Authorization: `Bearer ${borrowerA.token}` },
      }),
      env,
    );
    assert.equal(crossTenantOffer.status, 404);

    // Borrower A attempts to provide consent for Tenant 2's application -> 404 Not Found
    const crossTenantConsent = await worker.fetch(
      new Request(`http://localhost/applications/${appBId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${borrowerA.token}` },
        body: JSON.stringify({ offerId, consentText: 'Unauthorized cross-tenant attempt' }),
      }),
      env,
    );
    assert.equal(crossTenantConsent.status, 404);
  });

  // 6. CONSENT INTEGRITY & DUPLICATE CONSENT PREVENTION
  it('Consent Integrity: Successfully accepts valid offer and rejects duplicate consent requests', async () => {
    const officer = await createUser('officer_c@gidfine.com', 'loan_officer');
    const borrower = await createUser('borrower_c@gidfine.com', 'borrower');

    const appId = ulid();
    const now = Date.now();
    sqlite.prepare(
      `INSERT INTO loan_applications (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, created_at, updated_at)
       VALUES (?, 'agency_default', ?, 'AGENCY_APPROVED', 600000, 6, ?, ?)`,
    ).run(appId, borrower.id, now, now);

    const quoteId = ulid();
    sqlite.prepare(
      `INSERT INTO quote_snapshots (id, agency_id, application_id, calculation_strategy, principal_pesewas, total_interest_pesewas, total_fees_pesewas, total_repayable_pesewas, monthly_repayment_pesewas, schedule_json, is_simulation, status, snapshot_hash, created_at)
       VALUES (?, 'agency_default', ?, 'FLAT_SIMULATION', 600000, 72000, 20000, 692000, 115333, '[]', 1, 'OFFERED', 'hashC', ?)`,
    ).run(quoteId, appId, now);

    const offerId = ulid();
    sqlite.prepare(
      `INSERT INTO borrower_offers (id, agency_id, application_id, quote_snapshot_id, offered_amount_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas, status, expires_at, created_by, created_at)
       VALUES (?, 'agency_default', ?, ?, 600000, 2400, 6, 115333, 'OFFERED', ?, ?, ?)`,
    ).run(offerId, appId, quoteId, now + 86400000, officer.id, now);

    // Initial valid consent
    const consentRes1 = await worker.fetch(
      new Request(`http://localhost/applications/${appId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${borrower.token}` },
        body: JSON.stringify({ offerId, consentText: 'I agree to the 6-month repayment terms.' }),
      }),
      env,
    );
    assert.equal(consentRes1.status, 201);
    const consentData = await consentRes1.json() as any;
    assert.ok(consentData.data.termsHash);
    assert.equal(consentData.data.status, 'BORROWER_ACCEPTED');

    // DUPLICATE CONSENT ATTEMPT: Offer already ACCEPTED -> MUST FAIL WITH 409 CONFLICT
    const dupConsentRes = await worker.fetch(
      new Request(`http://localhost/applications/${appId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${borrower.token}` },
        body: JSON.stringify({ offerId, consentText: 'Duplicate consent submission' }),
      }),
      env,
    );
    assert.equal(dupConsentRes.status, 409);
  });
});
