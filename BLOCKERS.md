# Blockers and answers

**Last updated:** 2026-10-30 (owner answered B-1 to B-11)
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
| **RESIDUAL** | The main question is answered; a smaller follow-up is still open. |
| **COUNSEL** | Needs a signed legal artefact. Do not improvise a substitute. |
| **ENGINEERING** | Ours to fix. No external input needed. |

---

## 1. Decided earlier — build to this (A1-A12)

Do not re-litigate these, and do not add a feature flag "just in case".

| # | Decision | ADR |
| --- | --- | --- |
| A1 | **Single agency.** Gidfine operates for itself. Keep `agency_id` filters as defence in depth. | [0001](./ADR/0001-tenancy-model.md) |
| A2 | **Monthly and annual rates quoted side by side**; method chosen per deal. | [0003](./ADR/0003-interest-calculation-method.md) |
| A3 | **Margin may be a share of interest or a markup on either side**, flat or percentage. *Refined by B-6: any combination is allowed.* | [0004](./ADR/0004-agency-margin-and-revenue.md) |
| A4 | **Revenue is recognised when cash is collected** — never at disbursement, never accrued. | [0004](./ADR/0004-agency-margin-and-revenue.md) |
| A5 | **Hybrid matching:** competitive 1-to-many, then sequential fallback. *Refined by B-8.* | [0008](./ADR/0008-lender-matching-workflow.md) |
| A6 | **Manual cashier payments only at launch.** No provider webhooks; `SIMULATED_MOMO`/`SIMULATED_BANK` are test-only. | [0010](./ADR/0010-payment-collection-scope.md) |
| A7 | **Negotiated terms must be typed, constrained fields** — never free text. A null grace or penalty means *none*, never a hidden default. | [0005](./ADR/0005-loan-product-parameters.md) |
| A8 | **In-app + email + SMS notifications**, funded by Gidfine. WhatsApp is out. | [0011](./ADR/0011-notification-channels-and-budget.md) |
| A9 | **Full document set at launch**: offer, agreement, schedule, receipts, statements — rendered from the stored immutable snapshots. | [0012](./ADR/0012-generated-financial-documents.md) |
| A10 | **Per-lender disclosure profiles, fail closed.** A lender with no profile sees nothing. | [0006](./ADR/0006-lender-kyc-disclosures.md) |
| A11 | **Impersonation is read-only, 15 minutes, audited, revocable.** Never add routes to the allowlist. | [0015](./ADR/0015-administrator-impersonation.md) |
| A12 | **DPC registration held; credit/moneylending licence held.** | [0013](./ADR/0013-data-protection-act-843.md), [0014](./ADR/0014-lending-regulatory-licensing.md) |

---

## 2. Answered 2026-10-30 (B-1 to B-11)

| # | Question | Answer | Residual |
| --- | --- | --- | --- |
| B-1 | KYC retention and readers | **5 years after the loan closes.** Readable by **agency staff, auditors and the borrower**; a lender may never open a KYC document. | Key custody/encryption model and the deletion procedure (R-6) |
| B-2 | Legal model | **Arranger for every product at launch** — contracts lender ↔ borrower, Gidfine holds no funds, lender is payee. *Supersedes the earlier "mixed per product" direction.* | Signed legal annex (C-4) |
| B-3 | Control replacing dual authorisation | **Daily supervisor reconciliation report over disbursements** — the detective control on that money movement. | Build it before the constraint is relaxed (E-7) |
| B-4 | Notification budget control | **No hard cap**; monitor volume and alert on abnormal spend. | Threshold, alert route, retry ceiling (R-4) |
| B-5 | Rounding to the pesewa | **Round half up.** Applies to both methods and every figure shown. | Worked fixtures (R-9) |
| B-6 | Margin combinations and tax | **Any combination allowed** (e.g. flat fee plus share). **VAT-exempt** as a financial/credit service. | Accountant confirmation in writing (R-8) |
| B-7 | Product bounds and early settlement | **Tenure: no cap**, configured per product. **Early settlement not allowed before maturity** — no rebate formula implemented. | Penalty ceiling and min/max amount (R-1) |
| B-8 | Competitive matching limits | **Every eligible lender** may see the application; **48-hour round timeout**, configurable; the agency triggers sequential fallback. | Whether counter-offers are allowed (R-2) |
| B-9 | Signature | **Audited click-to-accept + SHA-256 terms hash** is sufficient. Wet signature may be recorded offline. | Document numbering scheme (R-3) |
| B-10 | Single disbursement approver | **`agency_admin` or `loan_officer`** — no new role. | Permission matrix detail: rate override, payment recording (R-10) |
| B-11 | Cashier reconciliation | **Daily, by the cashier supervisor.** | Discrepancy escalation path (R-7) |

Two consequences worth stating plainly:

- **B-2 removed work.** With one arranger model, there is no per-product legal
  attribute, no trust/liability account, and no receivable ledger. Commission
  revenue is the only revenue posting.
- **B-8 raised the privacy bar.** "All eligible lenders" makes the eligibility
  filter *the* disclosure control, so eligibility rules must be audited against
  the per-lender profile (ADR-0006) before live matching.

---

## 3. Still open

### 3.1 Residual owner questions (small)

| # | Question | Affects |
| --- | --- | --- |
| R-1 | Maximum late-penalty rate, and minimum/maximum loan amount | [0005](./ADR/0005-loan-product-parameters.md) |
| R-2 | May lenders counter-offer, and who approves a counter? | [0008](./ADR/0008-lender-matching-workflow.md) |
| R-3 | Document numbering scheme (auditable, gap-free) | [0012](./ADR/0012-generated-financial-documents.md) |
| R-4 | Alerting threshold and route for notification spend, plus the retry ceiling | [0011](./ADR/0011-notification-channels-and-budget.md) |
| R-5 | Email/SMS provider selection, who holds the accounts, SMS consent/opt-out, message templates | [0011](./ADR/0011-notification-channels-and-budget.md) |
| R-6 | Encryption/key custody for stored documents, and the deletion/anonymisation procedure at 5 years | [0007](./ADR/0007-document-retention-policy.md) |
| R-7 | Escalation path when the daily cashier total does not match the ledger | [0010](./ADR/0010-payment-collection-scope.md) |
| R-8 | Written accountant confirmation that the agency margin is VAT-exempt | [0004](./ADR/0004-agency-margin-and-revenue.md) |
| R-9 | Which methods each product may use, plus worked fixtures at round-half-up | [0003](./ADR/0003-interest-calculation-method.md) |
| R-10 | Remaining permission-matrix cells: rate override, who records vs reverses a payment | [0009](./ADR/0009-maker-checker-and-approvals.md) |

### 3.2 Counsel artefacts

| # | Artefact | Blocks |
| --- | --- | --- |
| C-1 | **Signed disclosure matrix per lender** — attribute list and legal basis | Enforcing per-lender profiles in production ([0006](./ADR/0006-lender-kyc-disclosures.md)) |
| C-2 | **Privacy notice text (versioned) and consent wording**, processing register, data-subject request procedure | Live borrower PII at commercial scale ([0013](./ADR/0013-data-protection-act-843.md)) |
| C-3 | **Licence reference, class, dates**, and confirmation each model sits inside the licensed scope, plus any interest/fee ceilings | Live disbursement ([0014](./ADR/0014-lending-regulatory-licensing.md)) |
| C-4 | **Signed legal operating-model annex** confirming the arranger model and the lender as payee | Contract generation ([0002](./ADR/0002-legal-operating-model.md)) |

A developer must not draft these. Where wording is needed mid-build, use neutral
placeholder copy marked as such, and never present it as approved.

---

## 4. Engineering blockers we own

| # | Issue | Evidence (2026-10-30) | Step |
| --- | --- | --- | --- |
| E-1 | **Worker typecheck is red** — 33 errors, so it cannot gate anything. | `npm run typecheck` in `workers/api` | S-00 |
| E-2 | **Pages Functions route only part of the API** — `health`, `auth/**`, `applications/**`, `borrower/**`, `admin/**` are covered. `lenders`, `lender/proposals`, `disbursements`, `loans`, `payments/:id/reverse`, `ledger/entries`, `documents`, `outbox`, `audit/security` **404 same-origin in production**, though the client calls them. | `frontend/functions/**` vs routes in `workers/api/src/index.ts` | S-01 |
| E-3 | **Three client calls have no handler**: `GET /loans/:id/schedule`, `/loans/:id/transactions`, `/loans/:id/outstanding`. | `frontend/src/lib/api-gidfine.ts` lines ~444-454 | S-02 |
| E-4 | **Legacy Convex surface still live** — 73 `convex` references under `frontend/src`. | `IMPLEMENTATION_PLAN.md` §8 | S-03 |
| E-5 | **Simulated MFA accepts fixed codes `123456` and `654321`.** Security defect, not a gate. | `workers/api/src/domain/hardeningMfa.ts` | S-06 |
| E-6 | **No CI** — typecheck, tests and build never run automatically. Stale `frontend/tests/*` read a non-existent `../../migrations/0001_initial_d1_schema.sql`. | only `.github/workflows/db-migrate.yml` exists | S-08 |
| E-7 | **Relaxing `check_maker_checker_distinct`** is now authorised in principle (B-3 answered) but is **sequenced last**: build the daily disbursement reconciliation report (S-07) first, prove it on fixtures, then migrate. | `0005_sprint4_consent_disbursement.sql` | S-07 → migration |

### Migration discipline (read before adding a migration)

- Next free number is **`0008_`**. `EXECUTION_PLAN.md` reserves it for the
  negotiated-term fields (S-04); if another change needs a migration first,
  renumber **both** the file and the plan.
- **Never rename an applied migration.** `0002_application_review.sql` and
  `0002_origination_review.sql` share a prefix but touch different objects and
  both apply cleanly. Renaming either would re-execute it wherever it is already
  recorded.
- Run migrations from `frontend/` with `--config wrangler.toml`; the standalone
  `workers/api/wrangler.jsonc` still carries a placeholder `database_id`.

---

## 5. Never do these

1. Move real money, or flip `simulation_mode` / `is_simulation`, before the
   matching ADR is **Accepted** and C-3 exists.
2. Drop `check_maker_checker_distinct` before the reconciliation report exists
   and passes on fixtures (E-7).
3. Bind R2 before R-6 (key custody + deletion procedure) is written. Retention
   (5 years) and readers are already decided — storage still is not.
4. Let an impersonated session write anything — the guard is the control.
5. Bill a borrower or lender for notifications (Gidfine pays) or add WhatsApp.
6. Implement an early-settlement rebate: B-7 says settlement before maturity is
   not allowed.
7. Give a lender access to a KYC document: B-1 limits readers to staff, auditors
   and the borrower.
8. Commit a secret, a real borrower record, or a production data export.
9. Invent a legal, tax or regulatory position to keep building. Stop and raise it.

---

## 6. How a blocker gets closed

1. The answer is written into the relevant ADR (`Decision`, `Rationale`, `Decided
   by`, `Accepted` date).
2. ADR status changes to **Accepted**, and the index in
   [`ADR/README.md`](./ADR/README.md) matches.
3. [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §3.1 row updated.
4. If it was a *Blocked* step, it moves to *Authorised* in
   [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md).
5. Remove the simulation flags named under that ADR's *Evidence in the codebase*.

A reviewer should reject a PR that skips any of these five.
