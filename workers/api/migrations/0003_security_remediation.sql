-- 0003_security_remediation.sql — trusted borrower responses & AES-256-GCM National ID encryption at rest.
-- Forward-only migration preserving all existing records.

PRAGMA foreign_keys = ON;

-- 1. Trusted borrower-authored responses to MORE_INFO_REQUIRED requests.
-- Must be authored exclusively by the authenticated borrower for their application.
CREATE TABLE borrower_responses (
  id              TEXT PRIMARY KEY,
  agency_id       TEXT NOT NULL REFERENCES agencies(id),
  application_id  TEXT NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  borrower_id     TEXT NOT NULL REFERENCES users(id),
  response_text   TEXT NOT NULL CHECK (length(trim(response_text)) > 0 AND length(response_text) <= 3000),
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_borrower_responses_app ON borrower_responses (agency_id, application_id, created_at);

-- 2. Encrypted National ID fields on borrower_profiles.
-- Plaintext id_number is preserved for backward-compatibility during zero-downtime conversion.
-- New and updated records store ciphertext, iv, auth tag, and key version.
ALTER TABLE borrower_profiles ADD COLUMN id_number_ciphertext TEXT;
ALTER TABLE borrower_profiles ADD COLUMN id_number_iv TEXT;
ALTER TABLE borrower_profiles ADD COLUMN id_number_tag TEXT;
ALTER TABLE borrower_profiles ADD COLUMN id_number_key_version INTEGER DEFAULT 1;
ALTER TABLE borrower_profiles ADD COLUMN id_number_masked TEXT;
