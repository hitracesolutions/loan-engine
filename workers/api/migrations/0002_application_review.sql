-- 0002_application_review.sql — agency review workflow.
-- Additive only: preserve existing applications and create an auditable review trail.

PRAGMA foreign_keys = ON;

ALTER TABLE loan_applications ADD COLUMN submitted_at INTEGER;
ALTER TABLE loan_applications ADD COLUMN assigned_officer_id TEXT REFERENCES users(id);

UPDATE loan_applications
SET submitted_at = created_at
WHERE submitted_at IS NULL AND status <> 'DRAFT';

CREATE TABLE application_status_history (
  id             TEXT PRIMARY KEY,
  agency_id      TEXT NOT NULL REFERENCES agencies(id),
  application_id TEXT NOT NULL REFERENCES loan_applications(id),
  actor_id       TEXT NOT NULL REFERENCES users(id),
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  reason         TEXT,
  created_at     INTEGER NOT NULL
);

CREATE TABLE application_review_notes (
  id             TEXT PRIMARY KEY,
  agency_id      TEXT NOT NULL REFERENCES agencies(id),
  application_id TEXT NOT NULL REFERENCES loan_applications(id),
  actor_id       TEXT NOT NULL REFERENCES users(id),
  note           TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 4000),
  created_at     INTEGER NOT NULL
);

CREATE INDEX idx_applications_agency_officer
  ON loan_applications (agency_id, assigned_officer_id);
CREATE INDEX idx_application_history_application
  ON application_status_history (agency_id, application_id, created_at);
CREATE INDEX idx_application_notes_application
  ON application_review_notes (agency_id, application_id, created_at);

INSERT INTO application_status_history
  (id, agency_id, application_id, actor_id, from_status, to_status, reason, created_at)
SELECT
  'migration_0002_' || id,
  agency_id,
  id,
  borrower_id,
  NULL,
  status,
  'Imported from the pre-review application baseline',
  created_at
FROM loan_applications;
