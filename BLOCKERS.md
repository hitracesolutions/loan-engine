# Blockers and answers

**Last updated:** 2026-10-30
**Purpose:** the single place a developer checks before starting work, so nobody
waits on a question that is already answered and nobody builds on a decision that
is not in force.
**Sources of truth:** [`ADR/`](./ADR/README.md) (decisions),
[`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md) (authorised steps),
[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §3.1 (gate status).

**Status key**

| Status | Meaning |
| --- | --- |
| **ANSWERED** | Decided. Build to it now. |
| **OWNER** | Needs one answer from the owner. Small, no counsel needed. |
| **COUNSEL** | Needs a signed legal artefact. Do not improvise a substitute. |
| **ENGINEERING** | Ours to fix. No external input needed. |

---

## 1. Already answered — build to this

Do not re-litigate these, and do not add a feature flag "just in case".

| # | Decision | ADR | What it means in code |
| --- | --- | --- | --- |
| A1 | **Single agency.** Gidfine operates for itself. | [0001](./ADR/0001-tenancy-model.md) | Keep `agency_id` filters — they are defence in depth, not a multi-tenant contract. No provisioning, billing or cross-agency suite. |
| A2 | **Monthly and annual rates quoted side by side**; the calculation method is chosen per deal. | [0003](./ADR/0003-interest-calculation-method.md) | Both bases must appear on every quote and disclosure. Method is a stored, negotiated term — see A7. |
| A3 | **Margin is mixed:** share of interest, or a markup on either the lender or the borrower side, flat or percentage. | [0004](./ADR/0004-agency-margin-and-revenue.md) | Model `margin_type`, `margin_side`, `margin_value` as data. Never hard-code one mechanism. |
| A4 | **Revenue is recognised when cash is collected.** | [0004](./ADR/0004-agency-margin-and-revenue.md) | Margin posts at payment allocation, and an unpaid or reversed instalment must not leave revenue behind. |
| A5 | **Matching is hybrid:** competitive 1-to-many, then sequential 1-to-1 fallback. | [0008](./ADR/0008-lender-matching-workflow.md) | Model both modes in the proposal state machine. Auto-generated proposal placeholders must not survive into live routing. |
| A6 | **Payments are manual cashier entry only at launch.** | [0010](./ADR/0010-payment-collection-scope.md) | No provider webhooks or reconciliation jobs. `SIMULATED_MOMO` / `SIMULATED_BANK` are test-only and must be unreachable in production paths. |
| A7 | **Terms are negotiated:** frequencies, grace, penalties, early settlement, pricing method and margin are set per product/deal. | [0005](./ADR/0005-loan-product-parameters.md) | Anything negotiated must be a typed, constrained field. Free-text negotiation fields are rejected at review. A null grace/penalty means *none*, never a hidden default. |
| A8 | **Notifications are in-app + email + SMS**, paid by Gidfine. WhatsApp is out. | [0011](./ADR/0011-notification-channels-and-budget.md) | Build against an adapter interface. Do not send anything until providers exist (B-4). |
| A9 | **Full document set at launch**: offer, credit agreement, schedule, receipts, statements. | [0012](./ADR/0012-generated-financial-documents.md) | Render from the stored immutable snapshots, never by recomputing. Generated artefacts must honour the same disclosure filtering as API responses. |
| A10 | **Per-lender disclosure profiles**, not a global ceiling. | [0006](./ADR/0006-lender-kyc-disclosures.md) | A lender with no profile must see **nothing** — fail closed. The mask helper becomes a policy enforcer, not a fixed shape. |
| A11 | **Impersonation is read-only, 15 minutes, audited, revocable.** | [0015](./ADR/0015-administrator-impersonation.md) | The pre-router guard already enforces it. Do not add routes to the allowlist. |
| A12 | **DPC registration is held; a credit/moneylending licence is held.** | [0013](./ADR/0013-data-protection-act-843.md), [0014](./ADR/0014-lending-regulatory-licensing.md) | Registration is no longer the blocker. The privacy notice wording and licence-scope confirmation still are (B-5, B-6). |

---

## 2. Waiting on the owner — one answer each

These are small questions. Until answered, use the *safe interim behaviour* — it
is chosen so no rework is wasted.

| # | Question | Blocks | Safe interim behaviour |
| --- | --- | --- | --- |
| B-1 | **How many years must KYC documents be retained?** (The record currently says "follow the regulator", which is circular.) Then: who may read a KYC document — agency staff, auditors, lender (probably not)? | R2 binding, document upload/download, deletion policy ([0007](./ADR/0007-document-retention-policy.md)) | Store metadata + SHA-256 only, as today. Build the upload path behind an interface with no binding. |
| B-2 | **Which product lines run under which legal model** (arranger / creditor of record / collection agent)? | Contracts, funded disbursement, ledger payee semantics ([0002](./ADR/0002-legal-operating-model.md)) | Add `product_legal_model` as a required attribute and reject disbursement for a product without it. |
| B-3 | **What replaces dual control on disbursement?** Single approver was approved, but the compensating control is unnamed. | Relaxing the `check_maker_checker_distinct` constraint ([0009](./ADR/0009-maker-checker-and-approvals.md)) | **Keep the constraint.** Dual control stays enforced; it blocks single-approver flows and that is currently correct. |
| B-4 | **Monthly ceiling for SMS/email, and who holds the provider accounts?** | Real notification adapters ([0011](./ADR/0011-notification-channels-and-budget.md)) | Keep the simulated dispatch adapter; build the send path but do not enable it. |
| B-5 | **Rounding rule to the pesewa for flat vs reducing balance**, and which methods each product may use. | Live pricing output ([0003](./ADR/0003-interest-calculation-method.md)) | Implement both strategies, keep `is_simulation = 1`, and write worked fixtures so the rule can be applied later without touching the engine. |
| B-6 | **Can a deal carry both a margin share and a flat fee? What is the VAT/withholding treatment per margin type?** | Ledger revenue accounts, invoicing, receipts ([0004](./ADR/0004-agency-margin-and-revenue.md)) | Store the terms; do not post revenue entries yet. |
| B-7 | **Bounds per product parameter:** maximum tenure, maximum penalty, allowed frequency set, min/max amount. Plus the **early-settlement formula** each product uses (rebate basis or penalty basis) — "negotiated" must become a computable rule. | Product catalogue validation, schedule generator ([0005](./ADR/0005-loan-product-parameters.md)) | Add the fields with nullable values and validation hooks; refuse to activate a product with an unset settlement rule. |
| B-8 | **Matching blast radius and timing:** how many lenders may see one application competitively, the round timeout, who triggers sequential fallback, and whether lenders may counter-offer. | Proposal state machine, lender queues ([0008](./ADR/0008-lender-matching-workflow.md)) | Model both modes; make limits configurable with conservative defaults; block counter-offers. |
| B-9 | **Document numbering scheme** (auditable, gap-free) and **whether an electronic signature is required**, and of what kind. | PDF generation, agreements ([0012](./ADR/0012-generated-financial-documents.md)) | Build the renderer against the stored snapshots; leave numbering and signing as unimplemented hooks. |
| B-10 | **Named approver roles and the permission matrix** — who may approve, override a rate, disburse, record a payment, reverse a payment. Map them to the code's role enum (`agency_admin`, `loan_officer`, `underwriter`, `cashier`, `auditor`, `lender`, `borrower`). | Disbursement endpoints, reversal authority ([0009](./ADR/0009-maker-checker-and-approvals.md)) | Keep the existing role checks; do not invent new roles. |
| B-11 | **Cashier reconciliation procedure** — who checks the daily total against the ledger, and how a discrepancy is escalated. | Manual payment control ([0010](./ADR/0010-payment-collection-scope.md)) | Build the report (S-07); the *process* around it is an owner decision. |

---

## 3. Waiting on counsel — signed artefacts only

| # | Artefact needed | Blocks |
| --- | --- | --- |
| C-1 | **Signed disclosure matrix per lender** — the attribute list a lender may lawfully see, and the legal basis. | Enforcing per-lender profiles in production ([0006](./ADR/0006-lender-kyc-disclosures.md)) |
| C-2 | **Approved privacy notice text (versioned) and consent wording**, plus the record of processing activities and the data-subject request procedure. | Live borrower PII at commercial scale ([0013](./ADR/0013-data-protection-act-843.md)) |
| C-3 | **Licence reference, class, issue/expiry dates**, and written confirmation that each operating model under B-2 sits inside the licensed scope, including any interest/fee ceilings. | Live disbursement, commercial launch ([0014](./ADR/0014-lending-regulatory-licensing.md)) |
| C-4 | **Signed legal operating-model annex per product model**, naming the contractual counterparty and the legal payee. | Contract generation ([0002](./ADR/0002-legal-operating-model.md)) |

A developer must not draft these. Where wording is needed mid-build, use neutral
placeholder copy marked as such, and never present it as approved.

---

## 4. Engineering blockers we own

No external input needed. These are the fastest unblockers.

| # | Blocking issue | Evidence (2026-10-30) | Step |
| --- | --- | --- | --- |
| E-1 | **Worker typecheck is red** — 33 errors, so it cannot gate anything. | `npm run typecheck` in `workers/api` | S-00 |
| E-2 | **Pages Functions route only part of the API** — `health`, `auth/**`, `applications/**`, `borrower/**`, `admin/**` (added). `lenders`, `lender/proposals`, `disbursements`, `loans`, `payments/:id/reverse`, `ledger/entries`, `documents`, `outbox`, `audit/security` **404 same-origin in production**, though the client calls them. | `frontend/functions/**` vs routes in `workers/api/src/index.ts` | S-01 |
| E-3 | **Three client calls have no handler**: `GET /loans/:id/schedule`, `/loans/:id/transactions`, `/loans/:id/outstanding`. | `frontend/src/lib/api-gidfine.ts` lines ~444-454 | S-02 |
| E-4 | **Legacy Convex surface still live** — 73 `convex` references under `frontend/src`. | `IMPLEMENTATION_PLAN.md` §8 | S-03 |
| E-5 | **Simulated MFA accepts fixed codes `123456` and `654321`.** Security defect, not a gate. | `workers/api/src/domain/hardeningMfa.ts` | S-06 |
| E-6 | **No CI** — typecheck, tests and build never run automatically. Stale `frontend/tests/*` read a non-existent `../../migrations/0001_initial_d1_schema.sql`. | no `.github/workflows` beyond `db-migrate.yml` | S-08 |

### Migration discipline (read before adding a migration)

- Next free number is **`0008_`**. `EXECUTION_PLAN.md` reserves it for the
  negotiated-term fields (S-04); if impersonation or another change needs a
  migration first, renumber **both** the file and the plan.
- **Never rename an applied migration.** `0002_application_review.sql` and
  `0002_origination_review.sql` share a prefix but touch different objects and
  both apply cleanly. Renaming either would re-execute it on every database
  where it is already recorded.
- Run migrations from `frontend/` with `--config wrangler.toml`; the standalone
  `workers/api/wrangler.jsonc` still carries a placeholder `database_id`.

---

## 5. Never do these

1. Move real money, or flip `simulation_mode` / `is_simulation`, before the
   matching ADR is **Accepted**.
2. Drop `check_maker_checker_distinct` before B-3 is answered.
3. Bind R2 before C-1/B-1 exist; store a KYC document with no retention rule.
4. Let an impersonated session write anything — the guard is the control.
5. Bill a borrower or lender for notifications (A8: Gidfine pays) or add WhatsApp.
6. Commit a secret, a real borrower record, or a production data export.
7. Invent a legal or regulatory position to keep building. Stop and raise it.

---

## 6. How a blocker gets closed

1. Owner / counsel answer is written into the relevant ADR (`Decision`,
   `Rationale`, `Decided by`, `Accepted` date).
2. ADR status changes to **Accepted**, and the index in
   [`ADR/README.md`](./ADR/README.md) matches.
3. [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §3.1 row updated.
4. If it was a *Blocked* step, it moves to *Authorised* in
   [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md).
5. Remove the simulation flags named under that ADR's *Evidence in the codebase*.

Only then does the work become shippable. A reviewer should reject a PR that
skips any of these five.
