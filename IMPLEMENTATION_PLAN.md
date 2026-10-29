# Gidfine Implementation Plan

**Status:** Phase 0 owner responses captured; Phase 1 implementation may begin
**Date:** 29 October 2026  
**Source of truth:** [`Gidfine_Dev_Guide.md`](./Gidfine_Dev_Guide.md)

## 1. Purpose

This plan turns the product requirements in the development guide into an
ordered delivery programme. It separates what is working today from what the
owners still need to decide and prevents unfinished features from being
presented as production capability.

## 2. Current baseline

### Working today

- React 19 + TypeScript + Vite frontend deployed to Cloudflare Pages project
  `loan-engine`.
- Pages Functions provide the production same-origin API and reuse the shared
  router in `workers/api/src`.
- Cloudflare D1 stores the current identity, agency, loan-application,
  idempotency and audit tables.
- Cloudflare KV is available for cache and idempotency support.
- Registration, login, current-user lookup, health checks, application create
  and application list are the current implemented API slice.
- Passwords use PBKDF2-HMAC-SHA-256 through Web Crypto; sessions use an
  application-issued HS256 JWT.
- Versioned D1 migrations, API tests, type checking and the frontend
  production build are part of the repository workflow.

### Not implemented yet

- Lender onboarding, lender products, lender proposals and counteroffers.
- Agency review queues, assignments, approval permissions and disclosure
  policies.
- Versioned pricing rules, quote snapshots and repayment schedule generation.
- Borrower consent, loans, disbursements, repayment allocation and reversals.
- Private document storage, generated contracts/receipts and document access
  policies.
- Notification outbox, delivery retries, email/SMS/WhatsApp integrations and
  overdue jobs.
- MFA, password recovery, privileged maker-checker controls and full audit
  reporting.
- R2, Durable Objects, Queues/Cron and Workers AI are not current launch
  dependencies. Add them only after the relevant owner decision is approved.

## 3. Owner decisions that block build

The owners should approve these decisions before the corresponding schema or
financial code is written.

| ID | Decision | Required output | Blocks |
| --- | --- | --- | --- |
| O-01 | Single Gidfine agency or multi-agency SaaS? | Tenancy ADR and `agency_id` policy | All domain migrations |
| O-02 | Is Gidfine an arranger only, or creditor/payee/collector? | Legal operating model | Contracts, disbursement and payments |
| O-03 | Rate basis and method: monthly/annual, flat/reducing/effective | Approved pricing policy | Quotes and schedules |
| O-04 | Margin model, fees, taxes and cash settlement | Pricing and revenue rules | Quote and ledger design |
| O-05 | Tenures, frequencies, grace, penalties and early settlement | Product catalogue rules | Schedule calculator |
| O-06 | Required lender identity/KYC disclosures | Disclosure matrix signed by legal | Proposal and notification payloads |
| O-07 | Document types, retention and access | Document policy | R2 decision and contracts |
| O-08 | Lender response model and one-to-many matching | Proposal workflow | Matching and lender portal |
| O-09 | Approval roles, rate changes and dual authorisation | Permission matrix | State transitions and maker-checker |
| O-10 | Manual payments or payment/mobile-money integration | Payment scope and provider contract | Ledger and reconciliation |
| O-11 | Notification channels, consent and budget | Event/channel matrix | Outbox and integrations |
| O-12 | Required generated documents | Template list and signing/consent rules | PDF/document delivery |
| O-13 | Ghana regulatory and licensing review | Written legal sign-off | Production launch |

### Owner decision register — 29 October 2026

The following responses were provided by the owner during implementation
planning. They define the initial product boundary; detailed pricing fixtures,
fee schedules and disclosure fields must still be written before the related
financial migrations are deployed.

| ID | Agreed direction |
| --- | --- |
| O-01 | Start as one Gidfine agency, but preserve a multi-agency SaaS boundary. |
| O-02 | Gidfine is an intermediary; lenders remain the creditor, funder and collector. |
| O-03 | Rate method may vary by lender/product and must be stored explicitly. |
| O-04 | Use a combination of rate spread and fees; fee payer may vary by lender/product. |
| O-05 | Gidfine defines standard loan rules; lenders may set narrower limits. |
| O-06 | Use a field-level disclosure matrix subject to legal requirements. |
| O-07 | Support private uploads first; add generated documents later. R2 is required for uploads. |
| O-08 | Allow multiple lenders to accept, decline or counter; Gidfine selects the final offer. |
| O-09 | Agency administrator approval is sufficient for the MVP. |
| O-10 | Lenders report repayments; Gidfine records and reconciles them manually first, with integrations later. |
| O-11 | Use in-app, email and SMS notifications; borrower and agency receive them by default, with lender delivery only when permitted. |
| O-12 | Generate loan contracts, disclosures, repayment schedules and payment receipts. |
| O-13 | Owner reports Ghana-qualified legal/regulatory review as complete; supporting evidence should be attached to the launch record. |

## 4. Delivery phases

### Phase 0 — decisions and acceptance fixtures

1. Run an owner workshop for O-01 through O-13.
2. Record decisions with owner, date, rationale and effective version.
3. Produce approved examples for flat and reducing-balance calculations,
   rounding, partial payments, reversals and late payments.
4. Agree the roles, permitted transitions and field visibility matrix.

**Exit gate:** signed product decisions, legal constraints and golden financial
fixtures exist in version control.

### Phase 1 — foundation and access control

- Add the approved membership/role model and server-side authorization layer.
- Add MFA/recovery for privileged users before financial approval access.
- Add request validation, consistent error contracts and object-level checks.
- Expand audit events to include actor, reason, before/after values and request
  correlation ID.
- Add tenant-isolation tests even if O-01 selects a single agency; this keeps
  the boundary explicit.

**Exit gate:** unauthorized direct API requests, ID enumeration and cross-role
field leakage are denied and tested.

### Phase 2 — origination and agency review

- Extend applications with borrower profile, required fields, assignment,
  review notes, hold/rejection reasons and state transition history.
- Implement borrower draft/save/submit and agency queue/filter/assignment.
- Build the borrower application screens and agency review queue using the
  typed API client.
- Keep lender-facing data out of borrower and agency response paths unless the
  disclosure policy allows it.

**Exit gate:** a borrower can submit an application and an authorized agency
user can review it without exposing restricted data.

### Phase 3 — lenders, matching and pricing

- Add lender profiles, products, rate cards, limits and availability.
- Add agency-controlled matching, proposal versions, accept/decline/counter
  responses and expiry rules.
- Implement a decimal-safe money/rate module using integer pesewas and basis
  points, with approved calculation-version metadata.
- Freeze the accepted quote and schedule snapshot; never recompute accepted
  terms from mutable current policy.
- Build lender proposal and agency matching screens.

**Exit gate:** lender acceptance never bypasses agency approval, and every
  displayed amount matches the approved fixture and disclosure matrix.

### Phase 4 — consent, approval and disbursement

- Add borrower offer/consent records and immutable consent evidence.
- Implement the ordered state machine:
  `LENDER_ACCEPTED → AGENCY_APPROVED → BORROWER_ACCEPTED →
  PENDING_DISBURSEMENT → ACTIVE`.
- Add maker-checker rules for approval, rate changes and disbursement when O-09
  requires them.
- Record funding reference, value date and confirmed amount before activating a
  repayment schedule.
- Build agency approval, borrower offer/consent and disbursement screens.

**Exit gate:** invalid transitions fail, terms cannot change after consent, and
  no active loan exists without confirmed disbursement.

### Phase 5 — servicing, ledger and reconciliation

- Add loans, schedules, installments, payment transactions and allocations.
- Add append-only journal/ledger entries and compensating reversals; prohibit
  edits or deletes of posted financial history.
- Require idempotency keys for payment posts and provider webhooks.
- Implement manual payment entry first unless O-10 approves an integration.
- Add outstanding balance, receipts, aging, reconciliation and closure rules.
- Build cashier/finance screens and borrower repayment history.

**Exit gate:** partial, late, overpaid, reversed and duplicate payments produce
  deterministic balances and complete audit evidence.

### Phase 6 — documents and notifications

- If O-07/O-12 approve private files, provision R2 and add document metadata,
  policy-checked upload/download, retention and malware/content validation.
- Add an event outbox and delivery status model. Use Queues only when volume or
  retry requirements justify the extra resource.
- Add email/SMS/WhatsApp adapters only for approved channels and consent.
- Use Cron or Workflows for reminders/overdue processing only after the event
  semantics and retry rules are tested.

**Exit gate:** notifications are emitted after committed transactions, contain
  only permitted fields, and retries cannot duplicate a financial action.

### Phase 7 — hardening and launch

- Run security tests for tenant escape, object enumeration, field leakage,
  export leakage, token handling and privileged actions.
- Run financial fixture tests, integration tests against local D1 and Pages
  Functions smoke tests.
- Complete UAT with borrower, lender, agency and finance scenarios.
- Document backup/restore, incident response, data retention, support access
  and rollback procedures.
- Configure monitoring, alerting and release/source-map practices before
  production launch.

**Exit gate:** signed UAT, legal approval, production checklist and rollback
plan are complete.

## 5. Migration sequence

Use forward-only migrations under `workers/api/migrations/`, one logical
change per migration. Apply locally first, test against a safe remote target,
then apply to production with an explicit backup/rollback note.

1. `0001_core.sql` remains the baseline.
2. Add identities/memberships/permissions and application review fields.
3. Add lender profiles/products, proposal versions and disclosure policies.
4. Add pricing policies, offers, consents and quote/schedule snapshots.
5. Add loans, disbursements, schedules and installments.
6. Add payments, allocations, journal transactions, ledger entries and
   reconciliation records.
7. Add documents, notifications, delivery attempts and integration metadata
   only after the owner gates are approved.

Never replace a production table with a conceptual schema in one destructive
operation. Prefer additive migrations, backfills, compatibility reads and a
separate cleanup migration after the new path is verified.

## 6. Cloudflare resource decisions

| Resource | Decision | Use now? |
| --- | --- | --- |
| Pages + Pages Functions | Keep as the production boundary | Yes |
| D1 | Authoritative relational state and migrations | Yes |
| KV | Cache and short-lived idempotency support; not financial truth | Yes |
| R2 | Private borrower documents and generated files | Only after O-07/O-12 |
| Queues/Cron | Notifications, retries and scheduled servicing work | After Phase 5/6 design |
| Durable Objects | Per-entity coordination or real-time sessions | Not unless a real-time requirement is approved |
| Workers AI/AI Gateway | Optional assistance or document processing | Not part of MVP acceptance |

## 7. Definition of done

A guide requirement is complete only when all of the following are true:

- The owner decision and business rule are recorded.
- The D1 migration and server-side route are implemented and tested.
- The frontend has loading, empty, error and permission-denied states.
- Disclosure and authorization are enforced before serialization/export.
- Financial mutations are guarded, idempotent and auditable.
- Acceptance fixtures and relevant security tests pass.
- The deployment/runbook and user-facing documentation are updated.
- Production verification has been performed without exposing secrets or full
  personal data in logs.

## 8. First implementation sprint

Start with the smallest unblocked slice after Phase 0:

1. Approve O-01, O-02, O-03, O-04 and O-09.
2. Add role/membership and application review migrations.
3. Implement agency queue, assignment and review-note endpoints.
4. Add server-side disclosure primitives and direct-request tests.
5. Connect the agency review queue to the existing React workspace.
6. Run the full API/typecheck/frontend-build verification before adding lender
   or financial tables.

This sprint creates a secure origination foundation without prematurely adding
R2, Durable Objects, a payment provider or a second backend runtime.
