import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

describe("Cloudflare D1 Database Foundation & Schema Constraints", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    const migrationPath = path.resolve(import.meta.dirname, "../../migrations/0001_initial_d1_schema.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");
    db.exec(sql);
  });

  it("successfully creates all 15 relational tables and indexes", () => {
    const tablesQuery = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;
    `);
    const tables = tablesQuery.all().map((row: any) => row.name);

    const expectedTables = [
      "agencies",
      "applications",
      "audit_logs",
      "consents",
      "disbursement_requests",
      "journal_lines",
      "journal_transactions",
      "ledger_entries",
      "lender_proposals",
      "password_reset_tokens",
      "repayment_receipts",
      "repayment_schedules",
      "reversal_requests",
      "user_sessions",
      "users",
    ].sort();

    assert.deepStrictEqual(tables, expectedTables);
  });

  it("enforces foreign key constraints across agency and user hierarchy", () => {
    // Attempting to insert a user for a non-existent agency must fail
    const insertUser = db.prepare(`
      INSERT INTO users (id, agency_id, role, email, status, created_at, updated_at)
      VALUES ('u1', ?, 'borrower', 'test@example.com', 'active', 1000, 1000);
    `);

    assert.throws(
      () => insertUser.run('non_existent_agency'),
      /FOREIGN KEY constraint failed/
    );

    // After inserting the agency, inserting the user with valid agency succeeds
    db.prepare(`
      INSERT INTO agencies (id, name, code, status, created_at)
      VALUES ('agency_1', 'Accra Central Agency', 'ACC01', 'active', 1000);
    `).run();

    const validUser = insertUser.run('agency_1');
    assert.strictEqual(validUser.changes, 1);
  });

  it("strictly enforces positive integer pesewas constraint on loan applications", () => {
    db.prepare(`INSERT INTO agencies (id, name, code, status, created_at) VALUES ('a1', 'Agency', 'A1', 'active', 1000);`).run();
    db.prepare(`INSERT INTO users (id, agency_id, role, email, status, created_at, updated_at) VALUES ('u1', 'a1', 'borrower', 'b@example.com', 'active', 1000, 1000);`).run();

    const insertApp = (amount: number) => {
      db.prepare(`
        INSERT INTO applications (id, agency_id, borrower_id, requested_amount_pesewas, tenure_months, purpose, status, created_at, updated_at)
        VALUES ('app_1', 'a1', 'u1', ?, 6, 'Business expansion', 'SUBMITTED', 1000, 1000);
      `).run(amount);
    };

    // Negative and zero amounts must be rejected by CHECK constraint
    assert.throws(() => insertApp(0), /CHECK constraint failed/);
    assert.throws(() => insertApp(-50000), /CHECK constraint failed/);

    // Positive integer succeeds (5,000.00 GHS = 500,000 pesewas)
    assert.doesNotThrow(() => insertApp(500000));
  });

  it("strictly enforces Maker-Checker segregation at the database schema level", () => {
    db.prepare(`INSERT INTO agencies (id, name, code, status, created_at) VALUES ('a1', 'Agency', 'A1', 'active', 1000);`).run();
    db.prepare(`INSERT INTO users (id, agency_id, role, email, status, created_at, updated_at) VALUES ('cashier1', 'a1', 'cashier', 'c@example.com', 'active', 1000, 1000);`).run();
    db.prepare(`INSERT INTO users (id, agency_id, role, email, status, created_at, updated_at) VALUES ('borrower1', 'a1', 'borrower', 'b@example.com', 'active', 1000, 1000);`).run();
    db.prepare(`INSERT INTO users (id, agency_id, role, email, status, created_at, updated_at) VALUES ('admin1', 'a1', 'agency_admin', 'adm@example.com', 'active', 1000, 1000);`).run();
    db.prepare(`INSERT INTO applications (id, agency_id, borrower_id, requested_amount_pesewas, tenure_months, purpose, status, created_at, updated_at) VALUES ('app1', 'a1', 'borrower1', 500000, 6, 'Shop', 'PENDING_DISBURSEMENT', 1000, 1000);`).run();

    // Maker attempts to approve their own disbursement request (maker_id == checker_id)
    const selfApprove = () => {
      db.prepare(`
        INSERT INTO disbursement_requests (
          id, agency_id, application_id, amount_pesewas, currency, status, maker_id, requested_at, checker_id, idempotency_key, created_at, updated_at
        ) VALUES ('req1', 'a1', 'app1', 500000, 'GHS', 'APPROVED', 'cashier1', 1000, 'cashier1', 'idemp_1', 1000, 1000);
      `).run();
    };

    assert.throws(selfApprove, /CHECK constraint failed/);

    // Distinct checker succeeds
    assert.doesNotThrow(() => {
      db.prepare(`
        INSERT INTO disbursement_requests (
          id, agency_id, application_id, amount_pesewas, currency, status, maker_id, requested_at, checker_id, idempotency_key, created_at, updated_at
        ) VALUES ('req1', 'a1', 'app1', 500000, 'GHS', 'APPROVED', 'cashier1', 1000, 'admin1', 'idemp_1', 1000, 1000);
      `).run();
    });
  });

  it("enforces tenant-scoped unique idempotency keys", () => {
    db.prepare(`INSERT INTO agencies (id, name, code, status, created_at) VALUES ('a1', 'Agency 1', 'A1', 'active', 1000);`).run();
    db.prepare(`INSERT INTO agencies (id, name, code, status, created_at) VALUES ('a2', 'Agency 2', 'A2', 'active', 1000);`).run();
    db.prepare(`INSERT INTO users (id, agency_id, role, email, status, created_at, updated_at) VALUES ('c1', 'a1', 'cashier', 'c1@a1.com', 'active', 1000, 1000);`).run();
    db.prepare(`INSERT INTO users (id, agency_id, role, email, status, created_at, updated_at) VALUES ('c2', 'a2', 'cashier', 'c2@a2.com', 'active', 1000, 1000);`).run();
    db.prepare(`INSERT INTO applications (id, agency_id, borrower_id, requested_amount_pesewas, tenure_months, purpose, status, created_at, updated_at) VALUES ('app1', 'a1', 'c1', 500000, 6, 'Purpose', 'PENDING_DISBURSEMENT', 1000, 1000);`).run();
    db.prepare(`INSERT INTO applications (id, agency_id, borrower_id, requested_amount_pesewas, tenure_months, purpose, status, created_at, updated_at) VALUES ('app2', 'a2', 'c2', 500000, 6, 'Purpose', 'PENDING_DISBURSEMENT', 1000, 1000);`).run();

    // Insert disbursement in agency a1 with idempotency key 'key_123'
    db.prepare(`
      INSERT INTO disbursement_requests (id, agency_id, application_id, amount_pesewas, currency, status, maker_id, requested_at, idempotency_key, created_at, updated_at)
      VALUES ('req1', 'a1', 'app1', 500000, 'GHS', 'PENDING_APPROVAL', 'c1', 1000, 'key_123', 1000, 1000);
    `).run();

    // Reusing 'key_123' in the SAME agency must be rejected
    assert.throws(
      () => {
        db.prepare(`
          INSERT INTO disbursement_requests (id, agency_id, application_id, amount_pesewas, currency, status, maker_id, requested_at, idempotency_key, created_at, updated_at)
          VALUES ('req2', 'a1', 'app1', 500000, 'GHS', 'PENDING_APPROVAL', 'c1', 1000, 'key_123', 1000, 1000);
        `).run();
      },
      /UNIQUE constraint failed/
    );

    // Using the same 'key_123' in DIFFERENT agency a2 is permitted (agency isolation)
    assert.doesNotThrow(() => {
      db.prepare(`
        INSERT INTO disbursement_requests (id, agency_id, application_id, amount_pesewas, currency, status, maker_id, requested_at, idempotency_key, created_at, updated_at)
        VALUES ('req3', 'a2', 'app2', 500000, 'GHS', 'PENDING_APPROVAL', 'c2', 1000, 'key_123', 1000, 1000);
      `).run();
    });
  });

  it("supports atomic execution of balanced double-entry journal transactions", () => {
    db.prepare(`INSERT INTO agencies (id, name, code, status, created_at) VALUES ('a1', 'Agency 1', 'A1', 'active', 1000);`).run();
    db.prepare(`INSERT INTO users (id, agency_id, role, email, status, created_at, updated_at) VALUES ('c1', 'a1', 'cashier', 'c1@a1.com', 'active', 1000, 1000);`).run();

    const txAmount = 250000; // GHS 2,500.00
    const now = Date.now();

    // Atomic transaction execution matching Cloudflare D1 batching semantics
    db.exec("BEGIN TRANSACTION;");

    db.prepare(`
      INSERT INTO journal_transactions (id, agency_id, transaction_type, reference, description, total_amount_pesewas, currency, posted_by, posted_at, is_reversal)
      VALUES ('tx_001', 'a1', 'DISBURSEMENT', 'DISB-REF-1', 'Loan disbursement to borrower', ?, 'GHS', 'c1', ?, 0);
    `).run(txAmount, now);

    // Debit Leg: Loans Receivable (Asset +)
    db.prepare(`
      INSERT INTO journal_lines (id, agency_id, transaction_id, account_code, account_name, account_type, entry_side, amount_pesewas, currency, created_at)
      VALUES ('line_1', 'a1', 'tx_001', '1200-LOANS_RECEIVABLE', 'Loans Principal Receivable', 'ASSET', 'DEBIT', ?, 'GHS', ?);
    `).run(txAmount, now);

    // Credit Leg: Cash Account (Asset -)
    db.prepare(`
      INSERT INTO journal_lines (id, agency_id, transaction_id, account_code, account_name, account_type, entry_side, amount_pesewas, currency, created_at)
      VALUES ('line_2', 'a1', 'tx_001', '1010-CASH', 'Operating Cash Account', 'ASSET', 'CREDIT', ?, 'GHS', ?);
    `).run(txAmount, now);

    db.exec("COMMIT;");

    // Verify balance invariant: Total Debits == Total Credits == Total Transaction Amount
    const balance = db.prepare(`
      SELECT
        SUM(CASE WHEN entry_side = 'DEBIT' THEN amount_pesewas ELSE 0 END) as total_debits,
        SUM(CASE WHEN entry_side = 'CREDIT' THEN amount_pesewas ELSE 0 END) as total_credits
      FROM journal_lines WHERE transaction_id = 'tx_001';
    `).get() as { total_debits: number; total_credits: number };

    assert.strictEqual(balance.total_debits, txAmount);
    assert.strictEqual(balance.total_credits, txAmount);
  });
});
