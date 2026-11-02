# ADR-0011 — Notification channels and budget

- **Gate:** O-11
- **Status:** Provisional — channel set 2026-10-30 (in-app + email + SMS, Gidfine-funded); providers outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Constrains:** outbox dispatch worker, credentials, ADR-0013

## Context

The transactional outbox exists and dispatches, but the delivery adapter is a
**simulation**: nothing is ever sent. Email and SMS need provider accounts,
credentials, sender identity and a budget owner, and SMS in particular needs a
consent basis and message templates that never leak lender-hidden data.

## Decision

**In-app + email + SMS.** WhatsApp is out of scope for now.

**Cost:** Gidfine absorbs the per-message cost. It is not charged back to the
lender or the borrower at launch.

**Budget control:** there is **no hard spend cap**. Instead, send volume is
monitored and the owner is alerted when daily or monthly spend looks abnormal.
Guardrails live in the outbox dispatch (per-message cost accounting and a retry
ceiling), not in a blocking limit.

## Rationale

Recorded direction: borrowers in the target market are reachable by SMS, while
email carries the document-grade correspondence. In-app remains the source of
truth for state; email and SMS are notifications about it.

## Consequences

- Two real adapters are needed (email provider, SMS provider) plus credential
  provisioning, retry/backoff behaviour and delivery-status tracking.
- Cost sits with Gidfine, so a monthly ceiling and an alerting threshold are
  needed before volume grows; without them an outbox retry storm becomes an
  unbudgeted SMS bill.
- Template review becomes a compliance task: no hidden borrower data, no rate
  disclosure that contradicts ADR-0003/ADR-0004 terms.
- Consent for SMS must be captured and stored, which links this record to
  ADR-0013.

## Outstanding before acceptance

- [ ] Provider selection for email and SMS, and who holds the accounts.
- [ ] Alerting threshold and notification route, set once provider pricing is
      known (no hard cap was chosen, so detection is the control).
- [ ] A retry ceiling per message, so a failing provider cannot multiply spend.
- [ ] SMS consent capture and opt-out handling.
- [ ] Message template set (none exist yet).

## Evidence in the codebase

- `workers/api/src/domain/documentsAndOutbox.ts` — simulated delivery adapter;
  `outbox_events` dispatch.
- `workers/api/src/routes/documentsAndOutbox.ts` — outbox status tracking and
  batch dispatch.
- `workers/api/migrations/0007_sprint6_sprint7_docs_outbox_hardening.sql` —
  `outbox_events`.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-11
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 12
