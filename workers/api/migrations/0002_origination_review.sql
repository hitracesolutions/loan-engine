-- 0002_origination_review.sql — application review notes, borrower profiles, review metadata.
-- Forward-only migration preserving all existing records.

PRAGMA foreign_keys = ON;

-- Internal notes recorded during agency review. Strictly staff-only access.
CREATE TABLE application_notes (
  id             TEXT PRIMARY KEY,
  agency_id      TEXT NOT NULL REFERENCES agencies(id),
  application_id TEXT NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  author_id      TEXT NOT NULL REFERENCES users(id),
  note_text      TEXT NOT NULL CHECK (length(trim(note_text)) > 0 AND length(note_text) <= 2000),
  is_internal    INTEGER NOT NULL DEFAULT 1 CHECK (is_internal IN (0, 1)),
  created_at     INTEGER NOT NULL
);

CREATE INDEX idx_application_notes_app ON application_notes (agency_id, application_id, created_at);

-- Verified borrower profile metadata (income, employer, identification).
CREATE TABLE borrower_profiles (
  id                     TEXT PRIMARY KEY,
  agency_id              TEXT NOT NULL REFERENCES agencies(id),
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth          TEXT,
  id_type                TEXT CHECK (id_type IS NULL OR id_type IN ('GHANA_CARD', 'PASSPORT', 'VOTER_ID', 'DRIVERS_LICENSE')),
  id_number              TEXT,
  employer               TEXT,
  monthly_salary_pesewas INTEGER CHECK (monthly_salary_pesewas IS NULL OR monthly_salary_pesewas >= 0),
  city                   TEXT,
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL,
  UNIQUE (agency_id, user_id)
);

CREATE INDEX idx_borrower_profiles_user ON borrower_profiles (agency_id, user_id);

-- Add rejection_reason to loan_applications for auditability upon AGENCY_REJECTED.
-- review_notes_count is safely derived via COUNT(*) from application_notes to avoid redundant state drift.
ALTER TABLE loan_applications ADD COLUMN rejection_reason TEXT;
