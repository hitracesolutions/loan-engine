-- 0005_sprint4_consent_disbursement.sql
-- Sprint 4: Versioned Offers, Immutable Consent Hash Evidence & Maker-Checker Disbursement Dual Control

PRAGMA foreign_keys = ON;

CREATE TABLE borrower_offers (
  id                         TEXT PRIMARY KEY,
  agency_id                  TEXT NOT NULL REFERENCES agencies(id),
  application_id             TEXT NOT NULL REFERENCES loan_applications(id),
  quote_snapshot_id          TEXT NOT NULL REFERENCES quote_snapshots(id),
  offered_amount_pesewas     INTEGER NOT NULL CHECK (offered_amount_pesewas > 0),
  nominal_annual_rate_bps    INTEGER NOT NULL CHECK (nominal_annual_rate_bps >= 0 AND nominal_annual_rate_bps <= 10000),
  tenure_months              INTEGER NOT NULL CHECK (tenure_months > 0),
  monthly_repayment_pesewas  INTEGER NOT NULL CHECK (monthly_repayment_pesewas > 0),
  status                     TEXT NOT NULL DEFAULT 'OFFERED' CHECK (status IN ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  expires_at                 INTEGER NOT NULL,
  created_by                 TEXT NOT NULL REFERENCES users(id),
  created_at                 INTEGER NOT NULL
);

CREATE INDEX idx_borrower_offers_app ON borrower_offers (agency_id, application_id, status);

CREATE TABLE borrower_consents (
  id                  TEXT PRIMARY KEY,
  agency_id           TEXT NOT NULL REFERENCES agencies(id),
  application_id      TEXT NOT NULL REFERENCES loan_applications(id),
  offer_id            TEXT NOT NULL REFERENCES borrower_offers(id),
  borrower_id         TEXT NOT NULL REFERENCES users(id),
  consent_text        TEXT NOT NULL,
  ip_address          TEXT,
  user_agent          TEXT,
  terms_hash          TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  UNIQUE(offer_id)
);

CREATE INDEX idx_borrower_consents_app ON borrower_consents (agency_id, application_id);

CREATE TABLE disbursement_records (
  id                          TEXT PRIMARY KEY,
  agency_id                   TEXT NOT NULL REFERENCES agencies(id),
  application_id              TEXT NOT NULL REFERENCES loan_applications(id),
  offer_id                    TEXT NOT NULL REFERENCES borrower_offers(id),
  amount_pesewas              INTEGER NOT NULL CHECK (amount_pesewas > 0),
  channel                     TEXT NOT NULL CHECK (channel IN ('SIMULATED', 'BANK_TRANSFER', 'MOBILE_MONEY')),
  destination_account_masked  TEXT NOT NULL,
  maker_id                    TEXT NOT NULL REFERENCES users(id),
  checker_id                  TEXT REFERENCES users(id),
  status                      TEXT NOT NULL DEFAULT 'PREPARED' CHECK (status IN ('PREPARED', 'APPROVED', 'REJECTED', 'DISBURSED', 'FAILED')),
  simulation_mode             INTEGER NOT NULL DEFAULT 1 CHECK (simulation_mode IN (0, 1)),
  reference                   TEXT NOT NULL,
  prepared_at                 INTEGER NOT NULL,
  checked_at                  INTEGER,
  disbursed_at                INTEGER,
  notes                       TEXT,
  CONSTRAINT check_maker_checker_distinct CHECK (checker_id IS NULL OR checker_id != maker_id)
);

CREATE INDEX idx_disbursements_app ON disbursement_records (agency_id, application_id, status);
