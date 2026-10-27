-- 0001_core.sql — tenancy, identity, applications, audit trail.
-- Conventions: TEXT ids (ULID), epoch-millisecond INTEGER timestamps,
-- money in INTEGER pesewas, rates in INTEGER basis points.

PRAGMA foreign_keys = ON;

CREATE TABLE agencies (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  agency_id      TEXT NOT NULL REFERENCES agencies(id),
  role           TEXT NOT NULL CHECK (role IN (
                   'agency_admin','loan_officer','underwriter','cashier','auditor','lender','borrower')),
  email          TEXT NOT NULL,
  phone          TEXT,
  full_name      TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

-- Case-insensitive uniqueness of email within an agency.
CREATE UNIQUE INDEX idx_users_agency_email ON users (agency_id, lower(email));
CREATE INDEX idx_users_agency_role ON users (agency_id, role);

CREATE TABLE loan_applications (
  id                       TEXT PRIMARY KEY,
  agency_id                TEXT NOT NULL REFERENCES agencies(id),
  borrower_id              TEXT NOT NULL REFERENCES users(id),
  status                   TEXT NOT NULL,
  requested_amount_pesewas INTEGER NOT NULL CHECK (requested_amount_pesewas > 0),
  tenure_months            INTEGER NOT NULL CHECK (tenure_months > 0),
  purpose                  TEXT,
  assigned_lender_id       TEXT REFERENCES users(id),
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);

CREATE INDEX idx_applications_agency_status ON loan_applications (agency_id, status);
CREATE INDEX idx_applications_borrower ON loan_applications (agency_id, borrower_id);
CREATE INDEX idx_applications_lender ON loan_applications (agency_id, assigned_lender_id);

-- Idempotency for client-originated mutations.
CREATE TABLE idempotency_keys (
  agency_id       TEXT NOT NULL,
  key             TEXT NOT NULL,
  scope           TEXT NOT NULL,
  response_body   TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (agency_id, key)
);

CREATE TABLE audit_events (
  id            TEXT PRIMARY KEY,
  agency_id     TEXT NOT NULL REFERENCES agencies(id),
  actor_id      TEXT,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  details       TEXT,
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_audit_agency_created ON audit_events (agency_id, created_at);
CREATE INDEX idx_audit_resource ON audit_events (agency_id, resource_type, resource_id);

-- Single-agency default tenant. Replace when multi-tenant onboarding is approved.
INSERT INTO agencies (id, slug, name, created_at)
VALUES ('agency_default', 'gidfine', 'Gidfine', 1740000000000);
