-- 0008 — Enforce payment-reference uniqueness at the database.
--
-- Finding 5 (DECISION_REVIEW.md): duplicate-payment prevention was a
-- check-then-act SELECT in application code with no database backstop, so two
-- concurrent requests with the same reference could both pass the pre-check and
-- both insert. A UNIQUE index makes the guarantee durable; the application
-- pre-check remains only to return a friendly 409 on the common case.
--
-- SQLite/D1 cannot ALTER TABLE ADD CONSTRAINT, so uniqueness is a unique index.

CREATE UNIQUE INDEX idx_cashier_payments_reference
  ON cashier_payments (agency_id, reference);
