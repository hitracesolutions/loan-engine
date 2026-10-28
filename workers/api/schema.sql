-- Gidfine Loan Agency Platform — D1 Schema (Single-Tenant)
-- All monetary values in PESEWAS (integer minor units)
-- All rates in BASIS POINTS (integer, e.g., 1800 = 18.00%)

-- ============================================
-- CORE: Agency & Configuration
-- ============================================

CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Ghana',
  currency TEXT NOT NULL DEFAULT 'GHS',
  agency_margin_bps INT NOT NULL DEFAULT 300,
  min_credit_score INT DEFAULT 600,
  max_dti_ratio_bps INT DEFAULT 5000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USERS: Borrowers, Lenders, Staff
-- ============================================

CREATE TABLE IF NOT EXISTS borrowers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  id_number TEXT,
  id_type TEXT,
  employer TEXT,
  monthly_salary_pesewas INT,
  credit_score INT DEFAULT 600,
  status TEXT DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lenders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  base_rate_bps INT NOT NULL,
  max_loan_pesewas INT NOT NULL,
  min_loan_pesewas INT NOT NULL,
  foir_limit_bps INT DEFAULT 4000,
  approval_probability_bps INT DEFAULT 8000,
  status TEXT DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lender_products (
  id TEXT PRIMARY KEY,
  lender_id TEXT NOT NULL REFERENCES lenders(id),
  product_name TEXT NOT NULL,
  min_tenure_months INT,
  max_tenure_months INT,
  min_amount_pesewas INT,
  max_amount_pesewas INT,
  base_rate_bps INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  last_login DATETIME,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LOAN ORIGINATION: Applications → Loans
-- ============================================

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  borrower_id TEXT NOT NULL REFERENCES borrowers(id),
  amount_requested_pesewas INT NOT NULL,
  tenure_months INT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  rejection_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (borrower_id) REFERENCES borrowers(id)
);

CREATE TABLE IF NOT EXISTS application_documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  document_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  file_size_bytes INT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE IF NOT EXISTS lender_proposals (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  lender_id TEXT NOT NULL REFERENCES lenders(id),
  status TEXT DEFAULT 'PENDING',
  lender_decision TEXT,
  counter_offer_rate_bps INT,
  counter_offer_amount_pesewas INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (lender_id) REFERENCES lenders(id)
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  borrower_id TEXT NOT NULL REFERENCES borrowers(id),
  lender_id TEXT NOT NULL REFERENCES lenders(id),
  principal_pesewas INT NOT NULL,
  lender_rate_bps INT NOT NULL,
  agency_margin_bps INT NOT NULL,
  borrower_rate_bps INT NOT NULL,
  tenure_months INT NOT NULL,
  status TEXT DEFAULT 'PENDING_DISBURSEMENT',
  disbursed_pesewas INT,
  disbursement_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT REFERENCES staff_users(id),
  approved_at DATETIME,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (borrower_id) REFERENCES borrowers(id),
  FOREIGN KEY (lender_id) REFERENCES lenders(id)
);

-- ============================================
-- REPAYMENT: Schedules & Payments
-- ============================================

CREATE TABLE IF NOT EXISTS repayment_schedules (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id),
  instalment_number INT NOT NULL,
  due_date DATE NOT NULL,
  amount_pesewas INT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  grace_days INT DEFAULT 0,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  UNIQUE(loan_id, instalment_number)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id),
  amount_pesewas INT NOT NULL,
  payment_method TEXT,
  reference_number TEXT,
  paid_date DATETIME NOT NULL,
  posted_by TEXT REFERENCES staff_users(id),
  status TEXT DEFAULT 'CLEARED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

-- ============================================
-- FINANCIAL LEDGER (Immutable)
-- ============================================

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id),
  entry_type TEXT NOT NULL,
  debit_pesewas INT,
  credit_pesewas INT,
  account TEXT NOT NULL,
  description TEXT,
  reversal_of_id TEXT REFERENCES ledger_entries(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES staff_users(id),
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

-- ============================================
-- DISCLOSURE & VISIBILITY
-- ============================================

CREATE TABLE IF NOT EXISTS disclosure_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  field_name TEXT NOT NULL,
  visible BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT & COMPLIANCE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  recipient_email TEXT,
  recipient_type TEXT,
  subject TEXT,
  message TEXT,
  channel TEXT DEFAULT 'in_app',
  status TEXT DEFAULT 'PENDING',
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INTEREST & PRICING POLICIES
-- ============================================

CREATE TABLE IF NOT EXISTS interest_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate_basis TEXT NOT NULL,
  rate_method TEXT NOT NULL,
  version INT DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES (Performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_borrowers_email ON borrowers(email);
CREATE INDEX IF NOT EXISTS idx_borrowers_status ON borrowers(status);
CREATE INDEX IF NOT EXISTS idx_applications_borrower ON applications(borrower_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_submitted ON applications(submitted_at);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_lender ON loans(lender_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_application ON loans(application_id);
CREATE INDEX IF NOT EXISTS idx_repayment_loan ON repayment_schedules(loan_id);
CREATE INDEX IF NOT EXISTS idx_repayment_due_date ON repayment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payment_transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payment_transactions(paid_date);
CREATE INDEX IF NOT EXISTS idx_ledger_loan ON ledger_entries(loan_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notification_events(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_events(status);

-- ============================================
-- SEED: Initialize Agency
-- ============================================

INSERT OR IGNORE INTO agencies (id, name, country, currency, agency_margin_bps)
VALUES ('agency-1', 'Gidfine', 'Ghana', 'GHS', 300);
