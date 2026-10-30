-- 0007_sprint6_sprint7_docs_outbox_hardening.sql
-- Sprint 6 & 7: Documents Metadata, Asynchronous Outbox, Privileged MFA & Security Observability

PRAGMA foreign_keys = ON;

-- Private Document Storage Metadata
CREATE TABLE document_records (
  id              TEXT PRIMARY KEY,
  agency_id       TEXT NOT NULL REFERENCES agencies(id),
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('APPLICATION', 'LOAN', 'BORROWER')),
  entity_id       TEXT NOT NULL,
  document_type   TEXT NOT NULL CHECK (document_type IN ('DISCLOSURE', 'SANCTION_LETTER', 'REPAYMENT_SCHEDULE', 'RECEIPT', 'STATEMENT')),
  filename        TEXT NOT NULL,
  storage_key     TEXT NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes      INTEGER NOT NULL CHECK (size_bytes >= 0),
  hash_sha256     TEXT NOT NULL,
  is_private      INTEGER NOT NULL DEFAULT 1 CHECK (is_private IN (0, 1)),
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_documents_entity ON document_records (agency_id, entity_type, entity_id);

-- Asynchronous Notification Outbox
CREATE TABLE outbox_events (
  id              TEXT PRIMARY KEY,
  agency_id       TEXT NOT NULL REFERENCES agencies(id),
  channel         TEXT NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'WHATSAPP')),
  recipient       TEXT NOT NULL,
  template_id     TEXT NOT NULL,
  payload_json    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED')),
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  processed_at    INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_outbox_status ON outbox_events (agency_id, status, created_at);

-- Privileged MFA Configuration
CREATE TABLE mfa_configurations (
  id                TEXT PRIMARY KEY,
  agency_id         TEXT NOT NULL REFERENCES agencies(id),
  user_id           TEXT NOT NULL REFERENCES users(id),
  mfa_type          TEXT NOT NULL DEFAULT 'TOTP' CHECK (mfa_type IN ('TOTP', 'SIMULATED_SMS')),
  secret_encrypted  TEXT NOT NULL,
  is_enabled        INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  last_used_at      INTEGER,
  created_at        INTEGER NOT NULL,
  UNIQUE(user_id)
);

-- Security Event Logs (rate limiting, suspicious events, privileged access)
CREATE TABLE security_audit_logs (
  id              TEXT PRIMARY KEY,
  agency_id       TEXT NOT NULL REFERENCES agencies(id),
  user_id         TEXT,
  event_type      TEXT NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  details         TEXT,
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_security_logs_event ON security_audit_logs (agency_id, event_type, created_at);
