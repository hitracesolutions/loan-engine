-- 0004_sprint3_lenders_matching_pricing.sql
-- Sprint 3: Lender Onboarding, Product Catalogue, Eligibility, Matching & Deterministic Pricing Engine

PRAGMA foreign_keys = ON;

CREATE TABLE lenders (
  id                  TEXT PRIMARY KEY,
  agency_id           TEXT NOT NULL REFERENCES agencies(id),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  license_number      TEXT,
  contact_email       TEXT NOT NULL,
  contact_phone       TEXT,
  status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  UNIQUE(agency_id, slug)
);

CREATE INDEX idx_lenders_agency ON lenders (agency_id, status);

CREATE TABLE lender_users (
  id                  TEXT PRIMARY KEY,
  agency_id           TEXT NOT NULL REFERENCES agencies(id),
  lender_id           TEXT NOT NULL REFERENCES lenders(id),
  user_id             TEXT NOT NULL REFERENCES users(id),
  role                TEXT NOT NULL DEFAULT 'lender_officer' CHECK (role IN ('lender_admin', 'lender_officer')),
  created_at          INTEGER NOT NULL,
  UNIQUE(lender_id, user_id)
);

CREATE INDEX idx_lender_users_user ON lender_users (agency_id, user_id);

CREATE TABLE lender_products (
  id                       TEXT PRIMARY KEY,
  agency_id                TEXT NOT NULL REFERENCES agencies(id),
  lender_id                TEXT NOT NULL REFERENCES lenders(id),
  product_name             TEXT NOT NULL,
  product_code             TEXT NOT NULL,
  description              TEXT,
  min_amount_pesewas       INTEGER NOT NULL CHECK (min_amount_pesewas > 0),
  max_amount_pesewas       INTEGER NOT NULL CHECK (max_amount_pesewas >= min_amount_pesewas),
  min_tenure_months        INTEGER NOT NULL CHECK (min_tenure_months > 0),
  max_tenure_months        INTEGER NOT NULL CHECK (max_tenure_months >= min_tenure_months),
  nominal_annual_rate_bps  INTEGER NOT NULL CHECK (nominal_annual_rate_bps >= 0 AND nominal_annual_rate_bps <= 10000),
  calculation_strategy     TEXT NOT NULL DEFAULT 'FLAT_SIMULATION' CHECK (calculation_strategy IN ('FLAT_SIMULATION', 'REDUCING_BALANCE_SIMULATION')),
  is_active                INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL,
  UNIQUE(agency_id, product_code)
);

CREATE INDEX idx_lender_products_lender ON lender_products (agency_id, lender_id, is_active);

CREATE TABLE product_eligibility_criteria (
  id                          TEXT PRIMARY KEY,
  agency_id                   TEXT NOT NULL REFERENCES agencies(id),
  product_id                  TEXT NOT NULL REFERENCES lender_products(id),
  min_monthly_income_pesewas  INTEGER NOT NULL DEFAULT 0,
  allowed_employment_types    TEXT, -- JSON array of strings e.g. ["SALARIED", "SELF_EMPLOYED"]
  max_debt_to_income_bps      INTEGER NOT NULL DEFAULT 5000, -- 50.00%
  created_at                  INTEGER NOT NULL,
  UNIQUE(product_id)
);

CREATE TABLE matching_runs (
  id                       TEXT PRIMARY KEY,
  agency_id                TEXT NOT NULL REFERENCES agencies(id),
  application_id           TEXT NOT NULL REFERENCES loan_applications(id),
  executed_by              TEXT NOT NULL REFERENCES users(id),
  matched_products_count   INTEGER NOT NULL DEFAULT 0,
  results_summary          TEXT,
  status                   TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at               INTEGER NOT NULL
);

CREATE INDEX idx_matching_runs_app ON matching_runs (agency_id, application_id);

CREATE TABLE lender_proposals (
  id                       TEXT PRIMARY KEY,
  agency_id                TEXT NOT NULL REFERENCES agencies(id),
  application_id           TEXT NOT NULL REFERENCES loan_applications(id),
  lender_id                TEXT NOT NULL REFERENCES lenders(id),
  product_id               TEXT NOT NULL REFERENCES lender_products(id),
  status                   TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED')),
  offered_amount_pesewas   INTEGER NOT NULL CHECK (offered_amount_pesewas > 0),
  nominal_annual_rate_bps  INTEGER NOT NULL CHECK (nominal_annual_rate_bps >= 0 AND nominal_annual_rate_bps <= 10000),
  tenure_months            INTEGER NOT NULL CHECK (tenure_months > 0),
  notes                    TEXT,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);

CREATE INDEX idx_proposals_app ON lender_proposals (agency_id, application_id);
CREATE INDEX idx_proposals_lender ON lender_proposals (agency_id, lender_id, status);

CREATE TABLE proposal_versions (
  id                       TEXT PRIMARY KEY,
  proposal_id              TEXT NOT NULL REFERENCES lender_proposals(id),
  version_number           INTEGER NOT NULL,
  offered_amount_pesewas   INTEGER NOT NULL,
  nominal_annual_rate_bps  INTEGER NOT NULL,
  tenure_months            INTEGER NOT NULL,
  actor_id                 TEXT NOT NULL REFERENCES users(id),
  action                   TEXT NOT NULL,
  notes                    TEXT,
  created_at               INTEGER NOT NULL,
  UNIQUE(proposal_id, version_number)
);

CREATE TABLE quote_snapshots (
  id                         TEXT PRIMARY KEY,
  agency_id                  TEXT NOT NULL REFERENCES agencies(id),
  application_id             TEXT NOT NULL REFERENCES loan_applications(id),
  proposal_id                TEXT REFERENCES lender_proposals(id),
  calculation_strategy       TEXT NOT NULL,
  principal_pesewas          INTEGER NOT NULL,
  total_interest_pesewas     INTEGER NOT NULL,
  total_fees_pesewas         INTEGER NOT NULL DEFAULT 0,
  total_repayable_pesewas    INTEGER NOT NULL,
  monthly_repayment_pesewas  INTEGER NOT NULL,
  schedule_json              TEXT NOT NULL,
  is_simulation              INTEGER NOT NULL DEFAULT 1 CHECK (is_simulation IN (0, 1)),
  status                     TEXT NOT NULL DEFAULT 'PROVISIONAL' CHECK (status IN ('PROVISIONAL', 'SUPERSEDED', 'OFFERED', 'ACCEPTED')),
  snapshot_hash              TEXT NOT NULL,
  created_at                 INTEGER NOT NULL
);

CREATE INDEX idx_quote_snapshots_app ON quote_snapshots (agency_id, application_id, status);
