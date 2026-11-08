import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { ensureAdminUser, hashPassword, signAccessToken } from '../src/lib/auth.ts';
import type { AppEnv } from '../src/env.ts';
import { ulid } from '../src/lib/ids.ts';

function createD1Adapter(sqliteDb: DatabaseSync, shouldFailQuery = false): D1Database {
  function createPreparedStatement(sql: string, params: any[] = []): D1PreparedStatement {
    return {
      bind(...values: any[]) {
        return createPreparedStatement(sql, values);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        if (shouldFailQuery) {
          throw new Error('D1_SIMULATED_FAILURE: table loans lock timeout');
        }
        const stmt = sqliteDb.prepare(sql);
        const row = stmt.get(...params);
        if (!row) return null;
        if (colName) return (row as any)[colName] ?? null;
        return row as T;
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        if (shouldFailQuery) {
          throw new Error('D1_SIMULATED_FAILURE: table loans lock timeout');
        }
        const stmt = sqliteDb.prepare(sql);
        const results = stmt.all(...params) as T[];
        return {
          results,
          success: true,
          meta: {} as any,
        };
      },
      async run(): Promise<D1Response> {
        if (shouldFailQuery) {
          throw new Error('D1_SIMULATED_FAILURE: table loans lock timeout');
        }
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

describe('Loan Servicing Endpoints (S-02 Acceptance Suite)', () => {
  let sqlite: DatabaseSync;
  let env: AppEnv;
  const JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-chars-long';
  const defaultAgencyId = 'agency_default';
  const otherAgencyId = 'agency_other';

  // Users & tokens
  let borrower1: { id: string; token: string };
  let borrower2: { id: string; token: string };
  let otherAgencyBorrower: { id: string; token: string };
  let cashier: { id: string; token: string };
  let loanOfficer: { id: string; token: string };
  let underwriter: { id: string; token: string };
  let admin: { id: string; token: string };

  // Loan IDs
  let activeLoanId: string;
  let zeroBalanceLoanId: string;
  let emptyLoanId: string;
  let otherAgencyLoanId: string;

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');

    // Apply all migrations
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

    // Ensure agencies exist
    sqlite
      .prepare('INSERT OR IGNORE INTO agencies (id, slug, name, created_at) VALUES (?, ?, ?, ?)')
      .run(otherAgencyId, 'other-agency', 'Other Agency', now);

    // Helper to create users
    async function createUser(email: string, role: string, agencyId: string, fullName: string) {
      const id = ulid();
      const passwordHash = await hashPassword('SecurePass123!');
      sqlite
        .prepare(
          `INSERT INTO users (id, agency_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(id, agencyId, email, passwordHash, fullName, role, now, now);

      const token = await signAccessToken(
        { userId: id, agencyId, role: role as any },
        JWT_SECRET,
        900,
      );
      return { id, token };
    }

    borrower1 = await createUser('borrower1@example.com', 'borrower', defaultAgencyId, 'Kofi Mensah');
    borrower2 = await createUser('borrower2@example.com', 'borrower', defaultAgencyId, 'Ama Serwaa');
    otherAgencyBorrower = await createUser('other@example.com', 'borrower', otherAgencyId, 'Kwame Nkrumah');
    cashier = await createUser('cashier@example.com', 'cashier', defaultAgencyId, 'Akosua Cashier');
    loanOfficer = await createUser('officer@example.com', 'loan_officer', defaultAgencyId, 'Yaw Officer');
    underwriter = await createUser('underwriter@example.com', 'underwriter', defaultAgencyId, 'Abena Underwriter');
    admin = await createUser('admin_test@example.com', 'agency_admin', defaultAgencyId, 'Kwesi Admin');

    // Create partner lender
    const lenderId = ulid();
    sqlite
      .prepare(
        `INSERT INTO lenders (id, agency_id, name, slug, contact_email, status, created_at, updated_at)
         VALUES (?, ?, 'Ghana Partner Bank', 'ghana-bank', 'partner@bank.com', 'ACTIVE', ?, ?)`,
      )
      .run(lenderId, defaultAgencyId, now, now);

    // Helper to seed loan
    function seedLoan(
      loanId: string,
      borrowerId: string,
      agencyId: string,
      principalPesewas: number,
      outstandingPrincipal: number,
      outstandingInterest: number,
      outstandingFees: number,
      status = 'ACTIVE',
    ) {
      const appId = ulid();
      const disbId = ulid();
      const offerId = ulid();
      const quoteId = ulid();

      sqlite
        .prepare(
          `INSERT INTO loan_applications (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, created_at, updated_at)
           VALUES (?, ?, ?, 'ACTIVE', ?, 3, ?, ?)`,
        )
        .run(appId, agencyId, borrowerId, principalPesewas, now, now);

      sqlite
        .prepare(
          `INSERT INTO quote_snapshots (id, agency_id, application_id, calculation_strategy, principal_pesewas, total_interest_pesewas, total_fees_pesewas, total_repayable_pesewas, monthly_repayment_pesewas, schedule_json, is_simulation, status, snapshot_hash, created_at)
           VALUES (?, ?, ?, 'FLAT_SIMULATION', ?, ?, ?, ?, ?, '[]', 1, 'ACCEPTED', 'hash123', ?)`,
        )
        .run(quoteId, agencyId, appId, principalPesewas, outstandingInterest, outstandingFees, principalPesewas + outstandingInterest + outstandingFees, 350000, now);

      sqlite
        .prepare(
          `INSERT INTO borrower_offers (id, agency_id, application_id, quote_snapshot_id, offered_amount_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas, status, expires_at, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, 2400, 3, 350000, 'ACCEPTED', ?, ?, ?)`,
        )
        .run(offerId, agencyId, appId, quoteId, principalPesewas, now + 86400000, admin.id, now);

      sqlite
        .prepare(
          `INSERT INTO disbursement_records (id, agency_id, application_id, offer_id, amount_pesewas, channel, destination_account_masked, maker_id, checker_id, status, simulation_mode, reference, prepared_at)
           VALUES (?, ?, ?, ?, ?, 'SIMULATED', 'MOMO', ?, ?, 'DISBURSED', 1, ?, ?)`,
        )
        .run(disbId, agencyId, appId, offerId, principalPesewas, admin.id, cashier.id, `REF-${loanId}`, now);

      sqlite
        .prepare(
          `INSERT INTO loans (
             id, agency_id, application_id, borrower_id, lender_id, disbursement_record_id,
             principal_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas,
             outstanding_principal_pesewas, outstanding_interest_pesewas, outstanding_fees_pesewas,
             status, disbursed_at, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 2400, 3, 350000, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          loanId,
          agencyId,
          appId,
          borrowerId,
          lenderId,
          disbId,
          principalPesewas,
          outstandingPrincipal,
          outstandingInterest,
          outstandingFees,
          status,
          now,
          now,
          now,
        );
    }

    activeLoanId = ulid();
    seedLoan(activeLoanId, borrower1.id, defaultAgencyId, 1000000, 800000, 40000, 20000, 'ACTIVE');

    zeroBalanceLoanId = ulid();
    seedLoan(zeroBalanceLoanId, borrower1.id, defaultAgencyId, 500000, 0, 0, 0, 'PAID_OFF');

    emptyLoanId = ulid();
    seedLoan(emptyLoanId, borrower2.id, defaultAgencyId, 200000, 200000, 20000, 10000, 'ACTIVE');

    otherAgencyLoanId = ulid();
    seedLoan(otherAgencyLoanId, otherAgencyBorrower.id, otherAgencyId, 300000, 300000, 30000, 10000, 'ACTIVE');

    // Seed repayment schedule & installments for activeLoanId
    const scheduleId = ulid();
    sqlite
      .prepare(
        `INSERT INTO repayment_schedules (id, agency_id, loan_id, version_number, created_at)
         VALUES (?, ?, ?, 1, ?)`,
      )
      .run(scheduleId, defaultAgencyId, activeLoanId, now);

    // Insert installments intentionally out of order to verify ascending query ordering
    sqlite
      .prepare(
        `INSERT INTO repayment_installments (id, schedule_id, installment_number, due_date, principal_due_pesewas, interest_due_pesewas, fees_due_pesewas, total_due_pesewas, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      )
      .run(ulid(), scheduleId, 3, now + 90 * 86400000, 333334, 20000, 0, 353334);

    sqlite
      .prepare(
        `INSERT INTO repayment_installments (id, schedule_id, installment_number, due_date, principal_due_pesewas, interest_due_pesewas, fees_due_pesewas, total_due_pesewas, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PAID')`,
      )
      .run(ulid(), scheduleId, 1, now + 30 * 86400000, 333333, 20000, 20000, 373333);

    sqlite
      .prepare(
        `INSERT INTO repayment_installments (id, schedule_id, installment_number, due_date, principal_due_pesewas, interest_due_pesewas, fees_due_pesewas, total_due_pesewas, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PARTIALLY_PAID')`,
      )
      .run(ulid(), scheduleId, 2, now + 60 * 86400000, 333333, 20000, 0, 353333);

    // Seed journal entry & cashier payments for activeLoanId
    const journalId = ulid();
    sqlite
      .prepare(
        `INSERT INTO journal_entries (id, agency_id, entry_number, entry_date, description, reference, status, created_by, created_at)
         VALUES (?, ?, 1, ?, 'Payment receipt', 'RCP-001', 'POSTED', ?, ?)`,
      )
      .run(journalId, defaultAgencyId, now, cashier.id, now);

    // Insert payments with different timestamps to test descending ordering
    sqlite
      .prepare(
        `INSERT INTO cashier_payments (id, agency_id, loan_id, cashier_id, amount_pesewas, payment_method, reference, allocated_principal_pesewas, allocated_interest_pesewas, allocated_fees_pesewas, journal_entry_id, is_reversed, created_at)
         VALUES (?, ?, ?, ?, 50000, 'CASH', 'CASH-PAY-001', 20000, 10000, 20000, ?, 0, ?)`,
      )
      .run(ulid(), defaultAgencyId, activeLoanId, cashier.id, journalId, now - 10000);

    sqlite
      .prepare(
        `INSERT INTO cashier_payments (id, agency_id, loan_id, cashier_id, amount_pesewas, payment_method, reference, allocated_principal_pesewas, allocated_interest_pesewas, allocated_fees_pesewas, journal_entry_id, is_reversed, created_at)
         VALUES (?, ?, ?, ?, 150000, 'SIMULATED_MOMO', 'MOMO-PAY-002', 150000, 0, 0, ?, 0, ?)`,
      )
      .run(ulid(), defaultAgencyId, activeLoanId, cashier.id, journalId, now);
  });

  // =========================================================================
  // 1. GET /loans/:id/schedule Tests
  // =========================================================================

  it('1. Schedule: Retrieves installments in strict ascending installment_number order', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/schedule`, {
        headers: { Authorization: `Bearer ${borrower1.token}` },
      }),
      env,
    );

    assert.equal(res.status, 200);
    const payload = (await res.json()) as any;
    assert.equal(payload.ok, true);
    const body = payload.data;
    assert.equal(body.loanId, activeLoanId);
    assert.ok(Array.isArray(body.installments));
    assert.ok(Array.isArray(body.results));
    assert.equal(body.installments.length, 3);

    // Verify ordering is strictly 1, 2, 3 despite unordered insertion
    assert.equal(body.installments[0].installment_number, 1);
    assert.equal(body.installments[1].installment_number, 2);
    assert.equal(body.installments[2].installment_number, 3);

    assert.equal(body.installments[0].status, 'PAID');
    assert.equal(body.installments[0].principal_due_pesewas, 333333);
  });

  it('2. Schedule: Empty installments list returns empty results array with 200 OK', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${emptyLoanId}/schedule`, {
        headers: { Authorization: `Bearer ${borrower2.token}` },
      }),
      env,
    );

    assert.equal(res.status, 200);
    const payload = (await res.json()) as any;
    assert.equal(payload.ok, true);
    const body = payload.data;
    assert.equal(body.loanId, emptyLoanId);
    assert.deepEqual(body.installments, []);
    assert.deepEqual(body.results, []);
  });

  it('3. Schedule: Cross-borrower access returns 404 Not Found to prevent enumeration', async () => {
    // Borrower 2 attempts to view Borrower 1's schedule
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/schedule`, {
        headers: { Authorization: `Bearer ${borrower2.token}` },
      }),
      env,
    );

    assert.equal(res.status, 404);
    const payload = (await res.json()) as any;
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'NOT_FOUND');
  });

  it('4. Schedule: Cross-agency access returns 404 Not Found', async () => {
    // Borrower in agency_other attempts to view loan in agency_default
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/schedule`, {
        headers: { Authorization: `Bearer ${otherAgencyBorrower.token}` },
      }),
      env,
    );

    assert.equal(res.status, 404);
  });

  it('5. Schedule: Missing loan ID returns 404 Not Found', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/non_existent_loan_id/schedule`, {
        headers: { Authorization: `Bearer ${borrower1.token}` },
      }),
      env,
    );

    assert.equal(res.status, 404);
  });

  it('6. Schedule: Unauthenticated request returns 401 Unauthorized', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/schedule`),
      env,
    );

    assert.equal(res.status, 401);
  });

  // =========================================================================
  // 2. GET /loans/:id/transactions Tests
  // =========================================================================

  it('7. Transactions: Retrieves cashier payments in descending created_at order with cashier name', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/transactions`, {
        headers: { Authorization: `Bearer ${borrower1.token}` },
      }),
      env,
    );

    assert.equal(res.status, 200);
    const payload = (await res.json()) as any;
    assert.equal(payload.ok, true);
    const body = payload.data;
    assert.equal(body.loanId, activeLoanId);
    assert.ok(Array.isArray(body.payments));
    assert.ok(Array.isArray(body.results));
    assert.equal(body.payments.length, 2);

    // Verify descending order (newest first)
    assert.ok(body.payments[0].created_at >= body.payments[1].created_at);
    assert.equal(body.payments[0].reference, 'MOMO-PAY-002');
    assert.equal(body.payments[1].reference, 'CASH-PAY-001');

    // Verify cashier name joined from users table
    assert.equal(body.payments[0].cashier_name, 'Akosua Cashier');
    assert.equal(body.payments[1].cashier_name, 'Akosua Cashier');
  });

  it('8. Transactions: Empty payments list returns empty results array with 200 OK', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${emptyLoanId}/transactions`, {
        headers: { Authorization: `Bearer ${borrower2.token}` },
      }),
      env,
    );

    assert.equal(res.status, 200);
    const payload = (await res.json()) as any;
    assert.equal(payload.ok, true);
    const body = payload.data;
    assert.equal(body.loanId, emptyLoanId);
    assert.deepEqual(body.payments, []);
    assert.deepEqual(body.results, []);
  });

  it('9. Transactions: Cross-borrower access returns 404 Not Found', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/transactions`, {
        headers: { Authorization: `Bearer ${borrower2.token}` },
      }),
      env,
    );

    assert.equal(res.status, 404);
  });

  it('10. Transactions: Cross-agency access returns 404 Not Found', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/transactions`, {
        headers: { Authorization: `Bearer ${otherAgencyBorrower.token}` },
      }),
      env,
    );

    assert.equal(res.status, 404);
  });

  it('11. Transactions: Missing loan returns 404 Not Found', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/non_existent_loan_id/transactions`, {
        headers: { Authorization: `Bearer ${borrower1.token}` },
      }),
      env,
    );

    assert.equal(res.status, 404);
  });

  it('12. Transactions: Unauthenticated request returns 401 Unauthorized', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/transactions`),
      env,
    );

    assert.equal(res.status, 401);
  });

  // =========================================================================
  // 3. GET /loans/:id/outstanding Tests
  // =========================================================================

  it('13. Outstanding: Calculates total accurate pesewas from principal, interest, and fees', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/outstanding`, {
        headers: { Authorization: `Bearer ${borrower1.token}` },
      }),
      env,
    );

    assert.equal(res.status, 200);
    const payload = (await res.json()) as any;
    assert.equal(payload.ok, true);
    const body = payload.data;

    assert.equal(body.loanId, activeLoanId);
    assert.equal(body.status, 'ACTIVE');

    // Expected: 800000 + 40000 + 20000 = 860000
    assert.equal(body.outstanding.principalPesewas, 800000);
    assert.equal(body.outstanding.interestPesewas, 40000);
    assert.equal(body.outstanding.feesPesewas, 20000);
    assert.equal(body.outstanding.totalPesewas, 860000);

    // Top-level fields
    assert.equal(body.outstandingPrincipalPesewas, 800000);
    assert.equal(body.outstandingInterestPesewas, 40000);
    assert.equal(body.outstandingFeesPesewas, 20000);
    assert.equal(body.totalOutstandingPesewas, 860000);
  });

  it('14. Outstanding: Zero balances calculate to exactly 0 pesewas total', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${zeroBalanceLoanId}/outstanding`, {
        headers: { Authorization: `Bearer ${borrower1.token}` },
      }),
      env,
    );

    assert.equal(res.status, 200);
    const payload = (await res.json()) as any;
    assert.equal(payload.ok, true);
    const body = payload.data;

    assert.equal(body.loanId, zeroBalanceLoanId);
    assert.equal(body.status, 'PAID_OFF');
    assert.equal(body.outstanding.principalPesewas, 0);
    assert.equal(body.outstanding.interestPesewas, 0);
    assert.equal(body.outstanding.feesPesewas, 0);
    assert.equal(body.outstanding.totalPesewas, 0);
    assert.equal(body.totalOutstandingPesewas, 0);
  });

  it('15. Outstanding: Cross-borrower access returns 404 Not Found', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/outstanding`, {
        headers: { Authorization: `Bearer ${borrower2.token}` },
      }),
      env,
    );

    assert.equal(res.status, 404);
  });

  it('16. Outstanding: Cross-agency access returns 404 Not Found', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/outstanding`, {
        headers: { Authorization: `Bearer ${otherAgencyBorrower.token}` },
      }),
      env,
    );

    assert.equal(res.status, 404);
  });

  it('17. Outstanding: Missing loan returns 404 Not Found', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/non_existent_loan_id/outstanding`, {
        headers: { Authorization: `Bearer ${borrower1.token}` },
      }),
      env,
    );

    assert.equal(res.status, 404);
  });

  it('18. Outstanding: Unauthenticated request returns 401 Unauthorized', async () => {
    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/outstanding`),
      env,
    );

    assert.equal(res.status, 401);
  });

  // =========================================================================
  // 4. Staff Roles & Error Handling
  // =========================================================================

  it('19. Staff Access: Agency staff roles can access all three servicing endpoints', async () => {
    const staffTokens = [cashier.token, loanOfficer.token, underwriter.token, admin.token];

    for (const token of staffTokens) {
      const scheduleRes = await worker.fetch(
        new Request(`http://localhost/loans/${activeLoanId}/schedule`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        env,
      );
      assert.equal(scheduleRes.status, 200);

      const txRes = await worker.fetch(
        new Request(`http://localhost/loans/${activeLoanId}/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        env,
      );
      assert.equal(txRes.status, 200);

      const balRes = await worker.fetch(
        new Request(`http://localhost/loans/${activeLoanId}/outstanding`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        env,
      );
      assert.equal(balRes.status, 200);
    }
  });

  it('20. Database Error: D1 failure returns structured 500 error without leaking SQL', async () => {
    const failingEnv = {
      ...env,
      DB: createD1Adapter(sqlite, true),
    } as AppEnv;

    const res = await worker.fetch(
      new Request(`http://localhost/loans/${activeLoanId}/outstanding`, {
        headers: { Authorization: `Bearer ${borrower1.token}` },
      }),
      failingEnv,
    );

    assert.equal(res.status, 500);
    const payload = (await res.json()) as any;
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'INTERNAL_ERROR');
    // Does not leak raw SQL query
    assert.ok(!JSON.stringify(payload).includes('SELECT l.*'));
  });
});
