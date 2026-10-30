import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { ensureAdminUser, hashPassword, signAccessToken } from '../src/lib/auth.ts';
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

describe('Gidfine Sprints 3-7 Comprehensive Verification', () => {
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

  async function createUser(email: string, role: string, fullName = 'Test User') {
    const id = ulid();
    const pwHash = await hashPassword('TestPassword123!');
    const now = Date.now();
    sqlite.prepare(
      `INSERT INTO users (id, agency_id, role, email, phone, full_name, password_hash, is_active, created_at, updated_at)
       VALUES (?, 'agency_default', ?, ?, '+233200000000', ?, ?, 1, ?, ?)`,
    ).run(id, role, email.toLowerCase(), fullName, pwHash, now, now);

    const token = await signAccessToken(
      { userId: id, agencyId: 'agency_default', role: role as any },
      JWT_SECRET,
      900,
    );
    return { id, email, token, role };
  }

  // SPRINT 3: LENDERS, PRODUCTS, MATCHING & PRICING
  it('Sprint 3: Onboards lenders, manages products, executes matching and enforces borrower PII masking', async () => {
    const admin = await createUser('admin2@gidfine.com', 'agency_admin', 'Admin User');
    const loanOfficer = await createUser('officer@gidfine.com', 'loan_officer', 'Loan Officer');
    const borrower = await createUser('borrower1@gidfine.com', 'borrower', 'Kwame Mensah');
    const lenderStaff = await createUser('lenderstaff@partnerbank.com', 'lender', 'Lender Agent');

    // 1. Admin onboards partner lender
    const createLenderRes = await worker.fetch(
      new Request('http://localhost/lenders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${admin.token}`,
        },
        body: JSON.stringify({
          name: 'CalBank SME Credit',
          slug: 'calbank-sme',
          contactEmail: 'sme@calbank.net',
          licenseNumber: 'BOG-LEND-2024-001',
        }),
      }),
      env,
    );
    assert.equal(createLenderRes.status, 201);
    const lenderData = await createLenderRes.json() as any;
    const lenderId = lenderData.data.lender.id;

    // Link lender user
    sqlite.prepare(
      `INSERT INTO lender_users (id, agency_id, lender_id, user_id, role, created_at)
       VALUES (?, 'agency_default', ?, ?, 'lender_officer', ?)`,
    ).run(ulid(), lenderId, lenderStaff.id, Date.now());

    // 2. Admin adds product with eligibility
    const createProdRes = await worker.fetch(
      new Request(`http://localhost/lenders/${lenderId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${admin.token}`,
        },
        body: JSON.stringify({
          productName: 'Quick SME Loan',
          productCode: 'CAL-SME-01',
          minAmountPesewas: 100000, // GH₵ 1,000
          maxAmountPesewas: 5000000, // GH₵ 50,000
          minTenureMonths: 3,
          maxTenureMonths: 24,
          nominalAnnualRateBps: 2200, // 22.00%
          minMonthlyIncomePesewas: 200000, // GH₵ 2,000
        }),
      }),
      env,
    );
    assert.equal(createProdRes.status, 201);

    // 3. Borrower creates loan application
    const appRes = await worker.fetch(
      new Request('http://localhost/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${borrower.token}`,
        },
        body: JSON.stringify({
          requestedAmountPesewas: 1500000, // GH₵ 15,000
          tenureMonths: 12,
          purpose: 'Inventory purchase for holiday trade',
        }),
      }),
      env,
    );
    assert.equal(appRes.status, 201);
    const appData = await appRes.json() as any;
    const appId = appData.data.id;

    // Set borrower profile with monthly income
    sqlite.prepare(
      `INSERT INTO borrower_profiles (
         id, agency_id, user_id, date_of_birth, id_type, id_number_masked,
         employer, monthly_salary_pesewas, city, created_at, updated_at
       ) VALUES (?, 'agency_default', ?, '1990-01-01', 'GHANA_CARD', 'GH****-9',
                 'Retail Corp', 350000, 'Accra', ?, ?)`,
    ).run(ulid(), borrower.id, Date.now(), Date.now());

    // 4. Staff executes matching
    const matchRes = await worker.fetch(
      new Request(`http://localhost/applications/${appId}/match`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${loanOfficer.token}` },
      }),
      env,
    );
    assert.equal(matchRes.status, 200);
    const matchData = await matchRes.json() as any;
    assert.equal(matchData.data.matches.length, 1);
    assert.equal(matchData.data.matches[0].productCode, 'CAL-SME-01');

    // 5. Lender views proposals: STRICT PII MASKING TEST (O-06)
    const lenderPropsRes = await worker.fetch(
      new Request('http://localhost/lender/proposals', {
        headers: { Authorization: `Bearer ${lenderStaff.token}` },
      }),
      env,
    );
    assert.equal(lenderPropsRes.status, 200);
    const propsData = await lenderPropsRes.json() as any;
    assert.equal(propsData.data.proposals.length, 1);

    const maskedProposal = propsData.data.proposals[0];
    const summary = maskedProposal.borrowerSummary;

    // VERIFY PII REDACTION: No full name, no phone, no email, no raw ID!
    assert.equal((summary as any).fullName, undefined);
    assert.equal((summary as any).email, undefined);
    assert.equal((summary as any).phone, undefined);
    assert.equal(summary.maskedNationalId, 'GH****-9');
    assert.equal(summary.residentialCity, 'Accra');
    assert.equal(summary.incomeBand, '1500_5000');
    assert.equal(summary.requestedAmountPesewas, 1500000);

    // 6. Lender responds ACCEPT
    const proposalId = maskedProposal.proposalId;
    const acceptRes = await worker.fetch(
      new Request(`http://localhost/lender/proposals/${proposalId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lenderStaff.token}`,
        },
        body: JSON.stringify({ action: 'ACCEPT', notes: 'Approved for prime SME credit' }),
      }),
      env,
    );
    assert.equal(acceptRes.status, 200);

    // 7. Generate deterministic quote simulation snapshot
    const quoteRes = await worker.fetch(
      new Request(`http://localhost/applications/${appId}/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loanOfficer.token}`,
        },
        body: JSON.stringify({ proposalId }),
      }),
      env,
    );
    assert.equal(quoteRes.status, 201);
    const quoteData = await quoteRes.json() as any;
    assert.equal(quoteData.data.isSimulation, true);
    assert.equal(quoteData.data.status, 'PROVISIONAL');
    assert.ok(quoteData.data.snapshotHash.length === 64);
    assert.equal(quoteData.data.installments.length, 12);
  });

  // SPRINT 4: CONSENT WORKFLOW & MAKER-CHECKER DISBURSEMENT
  it('Sprint 4: Versioned offer, immutable SHA-256 consent evidence, and Maker-Checker dual control', async () => {
    const admin = await createUser('admin_s4@gidfine.com', 'agency_admin', 'Admin');
    const officer = await createUser('officer_s4@gidfine.com', 'loan_officer', 'Loan Officer Maker');
    const cashier = await createUser('cashier_s4@gidfine.com', 'cashier', 'Cashier Checker');
    const borrower = await createUser('borrower_s4@gidfine.com', 'borrower', 'Ama Serwaa');

    // Create application
    const appId = ulid();
    const now = Date.now();
    sqlite.prepare(
      `INSERT INTO loan_applications (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, created_at, updated_at)
       VALUES (?, 'agency_default', ?, 'UNDER_REVIEW', 2000000, 6, ?, ?)`,
    ).run(appId, borrower.id, now, now);

    // Generate quote snapshot
    const quoteRes = await worker.fetch(
      new Request(`http://localhost/applications/${appId}/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officer.token}`,
        },
        body: JSON.stringify({
          principalPesewas: 2000000,
          nominalAnnualRateBps: 2400,
          tenureMonths: 6,
        }),
      }),
      env,
    );
    const quoteData = await quoteRes.json() as any;
    const quoteId = quoteData.data.quoteId;

    // 1. Agency issues formal offer
    const offerRes = await worker.fetch(
      new Request(`http://localhost/applications/${appId}/offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officer.token}`,
        },
        body: JSON.stringify({ quoteSnapshotId: quoteId }),
      }),
      env,
    );
    assert.equal(offerRes.status, 201);
    const offerData = await offerRes.json() as any;
    const offerId = offerData.data.offerId;

    // Verify application transitioned to AGENCY_APPROVED
    const appRow = sqlite.prepare(`SELECT status FROM loan_applications WHERE id = ?`).get(appId) as any;
    assert.equal(appRow.status, 'AGENCY_APPROVED');

    // 2. Borrower provides consent
    const consentRes = await worker.fetch(
      new Request(`http://localhost/applications/${appId}/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${borrower.token}`,
        },
        body: JSON.stringify({
          offerId,
          consentText: 'I accept the loan terms and repayment schedule as presented.',
        }),
      }),
      env,
    );
    assert.equal(consentRes.status, 201);
    const consentData = await consentRes.json() as any;
    assert.ok(consentData.data.termsHash.length === 64);
    assert.equal(consentData.data.status, 'BORROWER_ACCEPTED');

    // 3. Maker prepares disbursement
    const prepDisbRes = await worker.fetch(
      new Request('http://localhost/disbursements/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officer.token}`, // MAKER
        },
        body: JSON.stringify({
          applicationId: appId,
          channel: 'SIMULATED',
          destinationAccountMasked: 'MTN Mobile Money: 024****123',
          notes: 'Prepared for simulated disbursement',
        }),
      }),
      env,
    );
    assert.equal(prepDisbRes.status, 201);
    const prepData = await prepDisbRes.json() as any;
    const disbId = prepData.data.disbursementId;

    // 4. MAKER-CHECKER VIOLATION TEST: Maker tries to confirm own disbursement
    const violationRes = await worker.fetch(
      new Request('http://localhost/disbursements/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officer.token}`, // SAME USER AS MAKER
        },
        body: JSON.stringify({ disbursementId: disbId }),
      }),
      env,
    );
    // MUST FAIL with 403 Forbidden
    assert.equal(violationRes.status, 403);

    // 5. Valid Checker confirms disbursement
    const confirmRes = await worker.fetch(
      new Request('http://localhost/disbursements/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashier.token}`, // DISTINCT CHECKER
        },
        body: JSON.stringify({ disbursementId: disbId, notes: 'Dual-control verified and approved' }),
      }),
      env,
    );
    assert.equal(confirmRes.status, 200);
    const confirmData = await confirmRes.json() as any;
    assert.equal(confirmData.data.status, 'ACTIVE');
    assert.ok(confirmData.data.loanId);

    // Verify application status is now ACTIVE
    const activeApp = sqlite.prepare(`SELECT status FROM loan_applications WHERE id = ?`).get(appId) as any;
    assert.equal(activeApp.status, 'ACTIVE');
  });

  // SPRINT 5: SERVICING, WATERFALL PAYMENTS & COMPENSATING REVERSALS
  it('Sprint 5: Waterfall payment allocation, balanced double-entry ledger, and compensating reversals', async () => {
    const admin = await createUser('admin_s5@gidfine.com', 'agency_admin', 'Admin');
    const cashier = await createUser('cashier_s5@gidfine.com', 'cashier', 'Cashier');
    const borrower = await createUser('borrower_s5@gidfine.com', 'borrower', 'Kofi Boahen');

    // Create active loan directly
    const loanId = ulid();
    const appId = ulid();
    const lenderId = ulid();
    const now = Date.now();

    sqlite.prepare(
      `INSERT INTO lenders (id, agency_id, name, slug, contact_email, status, created_at, updated_at)
       VALUES (?, 'agency_default', 'Test Lender', 'test-lender', 'test@lender.com', 'ACTIVE', ?, ?)`,
    ).run(lenderId, now, now);

    sqlite.prepare(
      `INSERT INTO loan_applications (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, created_at, updated_at)
       VALUES (?, 'agency_default', ?, 'ACTIVE', 1000000, 3, ?, ?)`,
    ).run(appId, borrower.id, now, now);

    const quoteId = ulid();
    sqlite.prepare(
      `INSERT INTO quote_snapshots (id, agency_id, application_id, calculation_strategy, principal_pesewas, total_interest_pesewas, total_fees_pesewas, total_repayable_pesewas, monthly_repayment_pesewas, schedule_json, is_simulation, status, snapshot_hash, created_at)
       VALUES (?, 'agency_default', ?, 'FLAT_SIMULATION', 1000000, 60000, 40000, 1100000, 350000, '[]', 1, 'ACCEPTED', 'hash123', ?)`,
    ).run(quoteId, appId, now);

    const offerId = ulid();
    sqlite.prepare(
      `INSERT INTO borrower_offers (id, agency_id, application_id, quote_snapshot_id, offered_amount_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas, status, expires_at, created_by, created_at)
       VALUES (?, 'agency_default', ?, ?, 1000000, 2400, 3, 350000, 'ACCEPTED', ?, ?, ?)`,
    ).run(offerId, appId, quoteId, now + 86400000, admin.id, now);

    const disbId = ulid();
    sqlite.prepare(
      `INSERT INTO disbursement_records (id, agency_id, application_id, offer_id, amount_pesewas, channel, destination_account_masked, maker_id, checker_id, status, simulation_mode, reference, prepared_at)
       VALUES (?, 'agency_default', ?, ?, 1000000, 'SIMULATED', 'MOMO', ?, ?, 'DISBURSED', 1, 'REF1', ?)`,
    ).run(disbId, appId, offerId, admin.id, cashier.id, now);

    sqlite.prepare(
      `INSERT INTO loans (
         id, agency_id, application_id, borrower_id, lender_id, disbursement_record_id,
         principal_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas,
         outstanding_principal_pesewas, outstanding_interest_pesewas, outstanding_fees_pesewas,
         status, disbursed_at, created_at, updated_at
       ) VALUES (?, 'agency_default', ?, ?, ?, ?, 1000000, 2400, 3, 350000, 1000000, 60000, 40000, 'ACTIVE', ?, ?, ?)`,
    ).run(loanId, appId, borrower.id, lenderId, disbId, now, now, now);

    // 1. Cashier records payment of GH₵ 800.00 (80,000 pesewas)
    // Waterfall should cover:
    // - Fees: 40,000 (all fees paid)
    // - Interest: 40,000 (partially paid, 20,000 remains)
    // - Principal: 0
    const payRes1 = await worker.fetch(
      new Request(`http://localhost/loans/${loanId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashier.token}`,
        },
        body: JSON.stringify({
          amountPesewas: 80000,
          paymentMethod: 'SIMULATED_MOMO',
          reference: 'MOMO-PAY-001',
        }),
      }),
      env,
    );
    assert.equal(payRes1.status, 201);
    const payData1 = await payRes1.json() as any;
    assert.equal(payData1.data.allocatedFees, 40000);
    assert.equal(payData1.data.allocatedInterest, 40000);
    assert.equal(payData1.data.allocatedPrincipal, 0);

    // Verify loan state
    const loanRow1 = sqlite.prepare(`SELECT * FROM loans WHERE id = ?`).get(loanId) as any;
    assert.equal(loanRow1.outstanding_fees_pesewas, 0);
    assert.equal(loanRow1.outstanding_interest_pesewas, 20000);
    assert.equal(loanRow1.outstanding_principal_pesewas, 1000000);
    assert.equal(loanRow1.status, 'ACTIVE');

    // 2. Verify double-entry balanced ledger entries
    const ledgerRes = await worker.fetch(
      new Request('http://localhost/ledger/entries', {
        headers: { Authorization: `Bearer ${admin.token}` },
      }),
      env,
    );
    assert.equal(ledgerRes.status, 200);
    const ledgerData = await ledgerRes.json() as any;
    const latestEntry = ledgerData.data.entries[0];
    assert.ok(latestEntry);

    // Sum of debits must equal sum of credits
    let sumDebits = 0;
    let sumCredits = 0;
    for (const line of latestEntry.lines) {
      sumDebits += line.debit_pesewas;
      sumCredits += line.credit_pesewas;
    }
    assert.equal(sumDebits, sumCredits);
    assert.equal(sumDebits, 80000);

    // 3. Compensating Reversal Test: Admin reverses payment
    const paymentId = payData1.data.paymentId;
    const revRes = await worker.fetch(
      new Request(`http://localhost/payments/${paymentId}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${admin.token}`,
        },
        body: JSON.stringify({ reason: 'Incorrect customer reference provided' }),
      }),
      env,
    );
    assert.equal(revRes.status, 200);

    // Verify payment marked reversed without deleting record
    const payRecord = sqlite.prepare(`SELECT is_reversed FROM cashier_payments WHERE id = ?`).get(paymentId) as any;
    assert.equal(payRecord.is_reversed, 1);

    // Verify balances restored
    const loanRowRestored = sqlite.prepare(`SELECT * FROM loans WHERE id = ?`).get(loanId) as any;
    assert.equal(loanRowRestored.outstanding_fees_pesewas, 40000);
    assert.equal(loanRowRestored.outstanding_interest_pesewas, 60000);
    assert.equal(loanRowRestored.outstanding_principal_pesewas, 1000000);
  });

  // SPRINT 6 & 7: DOCUMENTS, OUTBOX, MFA & SECURITY LOGS
  it('Sprint 6 & 7: Document registration, outbox queueing, and privileged MFA lifecycle', async () => {
    const admin = await createUser('admin_s67@gidfine.com', 'agency_admin', 'Admin Privileged');

    // 1. Register private loan agreement document
    const docRes = await worker.fetch(
      new Request('http://localhost/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${admin.token}`,
        },
        body: JSON.stringify({
          entityType: 'LOAN',
          entityId: 'loan_12345',
          documentType: 'SANCTION_LETTER',
          filename: 'sanction_letter_12345.pdf',
          storageKey: 'private/agreements/12345.pdf',
          content: 'Sanction letter simulated binary payload contents...',
        }),
      }),
      env,
    );
    assert.equal(docRes.status, 201);
    const docData = await docRes.json() as any;
    assert.ok(docData.data.hashSha256.length === 64);

    // 2. Query documents
    const listDocRes = await worker.fetch(
      new Request('http://localhost/documents?entityType=LOAN&entityId=loan_12345', {
        headers: { Authorization: `Bearer ${admin.token}` },
      }),
      env,
    );
    assert.equal(listDocRes.status, 200);
    const listDocs = await listDocRes.json() as any;
    assert.equal(listDocs.data.documents.length, 1);

    // 3. Process Outbox batch
    const outboxRes = await worker.fetch(
      new Request('http://localhost/outbox/process', {
        method: 'POST',
        headers: { Authorization: `Bearer ${admin.token}` },
      }),
      env,
    );
    assert.equal(outboxRes.status, 200);

    // 4. Privileged MFA Setup
    const mfaSetupRes = await worker.fetch(
      new Request('http://localhost/auth/mfa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${admin.token}` },
      }),
      env,
    );
    assert.equal(mfaSetupRes.status, 201);
    const mfaData = await mfaSetupRes.json() as any;
    assert.equal(mfaData.data.isEnabled, true);

    // 5. Privileged MFA Verify (Valid test token)
    const mfaVerifyRes = await worker.fetch(
      new Request('http://localhost/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${admin.token}`,
        },
        body: JSON.stringify({ code: '123456' }),
      }),
      env,
    );
    assert.equal(mfaVerifyRes.status, 200);

    // 6. Security Audit Logs
    const secLogsRes = await worker.fetch(
      new Request('http://localhost/audit/security', {
        headers: { Authorization: `Bearer ${admin.token}` },
      }),
      env,
    );
    assert.equal(secLogsRes.status, 200);
    const secLogs = await secLogsRes.json() as any;
    assert.ok(secLogs.data.logs.length >= 2);
  });
});
