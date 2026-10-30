-- 0006_sprint5_servicing_ledger.sql
-- Sprint 5: Double-Entry Financial Ledger, Chart of Accounts, Loan Servicing, Waterfall Payments & Compensating Reversals

PRAGMA foreign_keys = ON;

-- Chart of accounts
CREATE TABLE accounts (
  id           TEXT PRIMARY KEY,
  agency_id    TEXT NOT NULL REFERENCES agencies(id),
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  description  TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at   INTEGER NOT NULL,
  UNIQUE(agency_id, code)
);

-- Seed standard accounts for default agency
INSERT INTO accounts (id, agency_id, code, name, type, description, is_active, created_at) VALUES
  ('acc_cash_clearing', 'agency_default', '1010', 'Cash & Mobile Money Clearing', 'ASSET', 'Clearing account for simulated and incoming cashier receipts', 1, 1740000000000),
  ('acc_loans_receivable', 'agency_default', '1200', 'Loans Receivable (Principal)', 'ASSET', 'Principal balance outstanding from borrowers', 1, 1740000000000),
  ('acc_interest_receivable', 'agency_default', '1210', 'Interest Receivable', 'ASSET', 'Accrued interest receivable', 1, 1740000000000),
  ('acc_fees_receivable', 'agency_default', '1220', 'Fees Receivable', 'ASSET', 'Origination and processing fees receivable', 1, 1740000000000),
  ('acc_lender_payable', 'agency_default', '2010', 'Lender Settlement Payable', 'LIABILITY', 'Funds payable to partner lenders', 1, 1740000000000),
  ('acc_interest_revenue', 'agency_default', '4010', 'Interest Income', 'REVENUE', 'Earned loan interest revenue', 1, 1740000000000),
  ('acc_fee_revenue', 'agency_default', '4020', 'Origination & Service Fee Income', 'REVENUE', 'Earned fee revenue', 1, 1740000000000);

-- Journal Entries (Append-only balanced transactions)
CREATE TABLE journal_entries (
  id           TEXT PRIMARY KEY,
  agency_id    TEXT NOT NULL REFERENCES agencies(id),
  entry_number INTEGER NOT NULL,
  entry_date   INTEGER NOT NULL,
  description  TEXT NOT NULL,
  reference    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   INTEGER NOT NULL,
  UNIQUE(agency_id, entry_number)
);

CREATE INDEX idx_journal_entries_ref ON journal_entries (agency_id, reference);

-- Journal Lines (Integer pesewas debit and credit)
CREATE TABLE journal_lines (
  id                TEXT PRIMARY KEY,
  journal_entry_id  TEXT NOT NULL REFERENCES journal_entries(id),
  account_id        TEXT NOT NULL REFERENCES accounts(id),
  debit_pesewas     INTEGER NOT NULL DEFAULT 0 CHECK (debit_pesewas >= 0),
  credit_pesewas    INTEGER NOT NULL DEFAULT 0 CHECK (credit_pesewas >= 0),
  memo              TEXT,
  created_at        INTEGER NOT NULL,
  CHECK (debit_pesewas > 0 OR credit_pesewas > 0),
  CHECK (NOT (debit_pesewas > 0 AND credit_pesewas > 0))
);

CREATE INDEX idx_journal_lines_entry ON journal_lines (journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines (account_id);

-- Servicing records (Loans)
CREATE TABLE loans (
  id                               TEXT PRIMARY KEY,
  agency_id                        TEXT NOT NULL REFERENCES agencies(id),
  application_id                   TEXT NOT NULL REFERENCES loan_applications(id),
  borrower_id                      TEXT NOT NULL REFERENCES users(id),
  lender_id                        TEXT NOT NULL REFERENCES lenders(id),
  disbursement_record_id           TEXT NOT NULL REFERENCES disbursement_records(id),
  principal_pesewas                INTEGER NOT NULL CHECK (principal_pesewas > 0),
  nominal_annual_rate_bps          INTEGER NOT NULL,
  tenure_months                    INTEGER NOT NULL,
  monthly_repayment_pesewas        INTEGER NOT NULL,
  outstanding_principal_pesewas    INTEGER NOT NULL CHECK (outstanding_principal_pesewas >= 0),
  outstanding_interest_pesewas     INTEGER NOT NULL CHECK (outstanding_interest_pesewas >= 0),
  outstanding_fees_pesewas         INTEGER NOT NULL CHECK (outstanding_fees_pesewas >= 0),
  status                           TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DELINQUENT', 'PAID_OFF', 'DEFAULTED', 'CLOSED')),
  disbursed_at                     INTEGER NOT NULL,
  closed_at                        INTEGER,
  created_at                       INTEGER NOT NULL,
  updated_at                       INTEGER NOT NULL,
  UNIQUE(application_id)
);

CREATE INDEX idx_loans_borrower ON loans (agency_id, borrower_id, status);
CREATE INDEX idx_loans_lender ON loans (agency_id, lender_id, status);

-- Repayment schedules
CREATE TABLE repayment_schedules (
  id              TEXT PRIMARY KEY,
  agency_id       TEXT NOT NULL REFERENCES agencies(id),
  loan_id         TEXT NOT NULL REFERENCES loans(id),
  version_number  INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  UNIQUE(loan_id, version_number)
);

CREATE TABLE repayment_installments (
  id                       TEXT PRIMARY KEY,
  schedule_id              TEXT NOT NULL REFERENCES repayment_schedules(id),
  installment_number       INTEGER NOT NULL,
  due_date                 INTEGER NOT NULL,
  principal_due_pesewas    INTEGER NOT NULL CHECK (principal_due_pesewas >= 0),
  interest_due_pesewas     INTEGER NOT NULL CHECK (interest_due_pesewas >= 0),
  fees_due_pesewas         INTEGER NOT NULL DEFAULT 0 CHECK (fees_due_pesewas >= 0),
  total_due_pesewas        INTEGER NOT NULL CHECK (total_due_pesewas > 0),
  principal_paid_pesewas   INTEGER NOT NULL DEFAULT 0 CHECK (principal_paid_pesewas >= 0),
  interest_paid_pesewas    INTEGER NOT NULL DEFAULT 0 CHECK (interest_paid_pesewas >= 0),
  fees_paid_pesewas        INTEGER NOT NULL DEFAULT 0 CHECK (fees_paid_pesewas >= 0),
  status                   TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')),
  paid_at                  INTEGER,
  UNIQUE(schedule_id, installment_number)
);

CREATE INDEX idx_installments_status ON repayment_installments (schedule_id, status);

-- Cashier receipts / payment transactions
CREATE TABLE cashier_payments (
  id                          TEXT PRIMARY KEY,
  agency_id                   TEXT NOT NULL REFERENCES agencies(id),
  loan_id                     TEXT NOT NULL REFERENCES loans(id),
  cashier_id                  TEXT NOT NULL REFERENCES users(id),
  amount_pesewas              INTEGER NOT NULL CHECK (amount_pesewas > 0),
  payment_method              TEXT NOT NULL CHECK (payment_method IN ('CASH', 'SIMULATED_MOMO', 'SIMULATED_BANK')),
  reference                   TEXT NOT NULL,
  allocated_principal_pesewas INTEGER NOT NULL DEFAULT 0,
  allocated_interest_pesewas  INTEGER NOT NULL DEFAULT 0,
  allocated_fees_pesewas      INTEGER NOT NULL DEFAULT 0,
  journal_entry_id            TEXT NOT NULL REFERENCES journal_entries(id),
  is_reversed                 INTEGER NOT NULL DEFAULT 0 CHECK (is_reversed IN (0, 1)),
  created_at                  INTEGER NOT NULL
);

CREATE INDEX idx_cashier_payments_loan ON cashier_payments (agency_id, loan_id);

-- Payment reversals (Compensating entries only; never delete posted entries)
CREATE TABLE payment_reversals (
  id                             TEXT PRIMARY KEY,
  agency_id                      TEXT NOT NULL REFERENCES agencies(id),
  cashier_payment_id             TEXT NOT NULL REFERENCES cashier_payments(id),
  reason                         TEXT NOT NULL,
  approved_by                    TEXT NOT NULL REFERENCES users(id),
  compensating_journal_entry_id  TEXT NOT NULL REFERENCES journal_entries(id),
  created_at                     INTEGER NOT NULL,
  UNIQUE(cashier_payment_id)
);
