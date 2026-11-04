# Gidfine Implementation Plan

**Status:** Sprints 1–7 implemented and verified in simulation/gated mode; remediation and forward steps (S-00–S-24) in progress.<br/>
**Updated:** 4 November 2026<br/>
**Source of truth for requirements:** [`Gidfine_Dev_Guide.md`](./Gidfine_Dev_Guide.md)<br/>
**Current test evidence:** `npm test` in `workers/api` → **88 pass / 0 fail**; frontend `npm run build` passes.<br/>
**Deployment:** `https://gidfin.dekacentral.com` is managed separately by Matthias (see §2.3). No remote D1 migration or live money movement is performed from this repo without the release gate (§14).

> This file merges what were formerly two plans — the implementation plan
> (baseline, gates, sprints, definition of done) and the execution plan
> (authorisation, forward steps, release gate, progress log). It is now the
> single plan. Companion docs: [`ADR/DECISIONS.md`](./ADR/DECISIONS.md)
> (decisions **and** the blocker triage), [`DECISION_REVIEW.md`](./DECISION_REVIEW.md)
> (review findings + remediation tasks + agent process rule),
> [`Gidfine_Dev_Guide.md`](./Gidfine_Dev_Guide.md) §17 (requirement traceability).

## Contents

- §1 Purpose · §2 Current baseline & architecture · **§3 Owner decisions that block build** · §3.1 Decision record status
- §4 Delivery phases · §5 Migration roadmap · §6 Sprint delivery history · §7 Cloudflare resource map · §8 Legacy Convex retirement · §9 Definition of done
- §10 Authorisation · §11 Safety floor & non-negotiables · §12 Remaining work — authorised steps (S-00–S-24) · §13 Externally gated · §14 Release gate · §15 Progress log · §16 Documentation protocol · §17 Changing this plan

---

## 1. Purpose

This plan translates the product requirements in [`Gidfine_Dev_Guide.md`](./Gidfine_Dev_Guide.md) into a concrete, dependency-ordered delivery programme. It records what works today, isolates requirements blocked by owner decisions (O-01 through O-14), prevents conceptual designs from masquerading as completed features, and defines the technical path from origination through ledger servicing to launch. Requirement-to-plan traceability lives in the guide's §17. Authorisation to execute and the forward step list are in §10–§12.

---

## 2. Current Baseline & Architecture Alignment

### 2.1 Working & Verified Today

- **Frontend:** React 19 + TypeScript + Vite SPA for Cloudflare Pages (project `loan-engine`); `npm run build` compiles cleanly.
- **Edge API & hosting:** Cloudflare Pages Functions in `frontend/functions/` are the same-origin production API boundary, forwarding to the shared TypeScript router in `workers/api/src/index.ts`. The standalone Worker in `workers/api/` is retained for isolated testing.
- **Database (D1):** authoritative SQLite via forward-only migrations in `workers/api/migrations/`. Foreign keys, positive-integer-pesewas checks, compound indexes.
- **Auth & crypto:** PBKDF2-HMAC-SHA-256 (100k iterations, 16-byte salt) password hashing; HS256 JWTs via WebCrypto HMAC (default 900s TTL, `JWT_SIGNING_KEY`); constant-time verification; admin bootstrap via `ensureAdminUser` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- **State machine:** `DRAFT → SUBMITTED → UNDER_REVIEW → MATCHING → LENDER_PENDING → LENDER_ACCEPTED → AGENCY_APPROVED → BORROWER_ACCEPTED → PENDING_DISBURSEMENT → ACTIVE → PAID_OFF → CLOSED`, non-bypass guards in `workers/api/src/domain/stateMachine.ts`.
- **Financial engine:** double-entry ledger (`sum(debit) == sum(credit)`), waterfall allocation (Fees → Interest → Principal), append-only compensating reversals, immutable SHA-256 quote/consent snapshots. All money paths now commit through a single `db.batch()` (atomic), with payment-reference uniqueness enforced at the database (migration `0008`).

### 2.2 Current test evidence

Measured 2026-11-04 with `npm test` in `workers/api`: **88 pass / 0 fail**. Worker `npm run typecheck` still has a known pre-existing error baseline (test-adapter D1 typing drift + a few `src` undefined-safety spots) — clearing it is step **S-00**; it does not affect runtime or the test run (tests execute via `--experimental-strip-types`). The frontend production build passes.

*(Historical snapshots, for the record: Sprint 1 baseline was 50/50; the programme baseline on 2026-10-30 was 81/81.)*

### 2.3 Deployment environment

1. `https://gidfin.dekacentral.com` is an independently hosted deployment managed by Matthias.
2. All work in this repo is on branch `development`.
3. No automated remote deployment, remote D1 migration, or live money movement is performed from this repo until the release gate (§14). Migration `0008` is committed but **not** applied to remote D1.

---

## 3. Owner Decisions That Block Build

These decisions must be formally approved before the corresponding schema migrations and financial code go live. The original assessment is kept intact; current status is in §3.1.

| ID | Decision Area | Required Deliverable | Technical Impact / Blocked Scope | Original Status |
| :--- | :--- | :--- | :--- | :--- |
| **O-01** | **Tenancy Model** | ADR on single-agency vs multi-agency SaaS | Schema is multi-tenant capable (`agency_id` everywhere, default `gidfine`); commercial policy needed before a second agency. | Provisionally resolved |
| **O-02** | **Legal Operating Model** | Signed model: arranger / creditor of record / collection agent | Blocks contracts, disbursement funding, payee identity, allocation liability. | BLOCKING Sprint 4 & 5 |
| **O-03** | **Interest Calculation Method** | Approved rate basis + method | Blocks pricing engine, quote versioning, schedule generation. | BLOCKING Sprint 3 |
| **O-04** | **Agency Margin & Revenue** | Approved margin formula + tax/withholding | Blocks quote calculation, ledger revenue design. | BLOCKING Sprint 3 & 5 |
| **O-05** | **Loan Product Parameters** | Catalogue rules: tenure, frequency, grace, penalty, early settlement | Blocks product config and schedule generator. | BLOCKING Sprint 3 |
| **O-06** | **Lender KYC Disclosures** | Legal disclosure matrix of borrower attributes visible to lenders | Blocks proposal masking + notification payloads; prevents identity leakage. | BLOCKING Sprint 3 |
| **O-07** | **Document Retention Policy** | Storage policy: files, access, retention, encryption | Blocks R2 binding and document upload/download. | BLOCKING Sprint 6 |
| **O-08** | **Lender Matching Workflow** | 1-to-1 sequential vs 1-to-many competitive routing | Blocks proposal state machine + lender queues. | BLOCKING Sprint 3 |
| **O-09** | **Maker-Checker & Approvals** | Role permission matrix for approval, overrides, disbursement | Blocks disbursement endpoints + dual-authorisation constraints. | BLOCKING Sprint 4 |
| **O-10** | **Payment Collection Scope** | Manual cashier vs automated MoMo/bank integration | Blocks payment webhooks + reconciliation. | BLOCKING Sprint 5 (manual default) |
| **O-11** | **Notification Channels & Budget** | In-app only vs external SMS/WhatsApp/Email + cost | Blocks notification worker + provider credentials. | BLOCKING Sprint 6 |
| **O-12** | **Generated Financial Documents** | Templates: disclosure, agreement, schedule, receipt | Blocks PDF generation + signing. | BLOCKING Sprint 6 |
| **O-13** | **Data Protection (Act 843)** | Legal sign-off on consent, privacy notices, data handling | Blocks commercial processing of live borrower PII. | BLOCKING Sprint 7 |
| **O-14** | **Lending & Credit Licensing** | BoG regulatory status confirmation | Blocks commercial launch + live disbursement. | BLOCKING Sprint 7 |

### 3.1 Decision record status

Every gate has a record in [`ADR/DECISIONS.md`](./ADR/DECISIONS.md). Owner answers were recorded 2026-10-30; the three review-driven proposals (ADR-0016/0017/0018) had their **directions decided 2026-11-03** and are Provisional pending their outstanding items (see [`DECISION_REVIEW.md`](./DECISION_REVIEW.md)).

| Gate | ADR | Status | Still outstanding |
| :--- | :--- | :--- | :--- |
| O-01 | [0001](./ADR/DECISIONS.md#adr-0001) | **Accepted** — single agency | SaaS onboarding needs a superseding ADR |
| O-02 | [0002](./ADR/DECISIONS.md#adr-0002) | Provisional — arranger for every product at launch; **but see ADR-0016**, which supersedes it with "Gidfine holds client funds" (direction decided 2026-11-03) | Trust account + licence-scope confirmation (ADR-0016); signed legal annex |
| O-03 | [0003](./ADR/DECISIONS.md#adr-0003) | Provisional — both bases quoted; method negotiated; round half up | Worked fixtures; allowed methods per product |
| O-04 | [0004](./ADR/DECISIONS.md#adr-0004) | Provisional — any margin combination, recognised on collection, VAT-exempt | Accountant confirmation |
| O-05 | [0005](./ADR/DECISIONS.md#adr-0005) | Provisional — flexible frequencies; tenure uncapped; no early settlement | Penalty ceiling; min/max amount; catalogue |
| O-06 | [0006](./ADR/DECISIONS.md#adr-0006) | Provisional — per-lender disclosure; **extended by ADR-0017** (assignable rights, default-deny, audited) | Rights catalogue; counsel lawful-basis sign-off |
| O-07 | [0007](./ADR/DECISIONS.md#adr-0007) | Provisional — 5-year retention; staff/auditor/borrower read | Key custody; deletion procedure |
| O-08 | [0008](./ADR/DECISIONS.md#adr-0008) | Provisional — hybrid competitive then sequential; all eligible lenders; 48h | Counter-offers; eligibility audited against profiles |
| O-09 | [0009](./ADR/DECISIONS.md#adr-0009) | Provisional — single approver + daily reconciliation; **superseded in direction by ADR-0018** (value-tiered; T a per-account setting; single approver when unset) | Role names; T settings UI; real MFA; migration `0009` conditional constraint |
| O-10 | [0010](./ADR/DECISIONS.md#adr-0010) | Provisional — manual cashier only; daily reconciliation | Discrepancy escalation path |
| O-11 | [0011](./ADR/DECISIONS.md#adr-0011) | Provisional — in-app + email + SMS, Gidfine-funded, alerting not hard cap | Providers; alert threshold; retry ceiling |
| O-12 | [0012](./ADR/DECISIONS.md#adr-0012) | Provisional — full document set; click-to-accept + terms hash | Templates; numbering; storage once O-07 closes |
| O-13 | [0013](./ADR/DECISIONS.md#adr-0013) | Provisional — DPC registration held | Privacy notice; consent wording; processing register |
| O-14 | [0014](./ADR/DECISIONS.md#adr-0014) | Provisional — credit/moneylending licence held | Licence reference; per-model scope |

Two consequences that must not be lost:

1. **O-09 / ADR-0018 is not in force.** Single-approver (tiered) disbursement contradicts the deployed `CHECK (checker_id IS NULL OR checker_id != maker_id)` in migration `0005`; dual control remains enforced until the reconciliation report and real MFA exist and a forward migration (`0009`) makes the constraint conditional on amount. The daily disbursement reconciliation report (the named compensating control) is **built** (S-07, 2026-11-04); reversal segregation is **shipped**.
2. **O-07 still blocks document storage.** No R2 bucket is bound; KYC upload and retention cannot be demonstrated until that record closes.

---

## 4. Delivery Phases & Milestone Verification

```
Phase 1  Foundation & Identity                         DONE  (migration 0001; PBKDF2/JWT; /auth, /applications)
Phase 2  Origination & Agency Review                   DONE  (0002, 0003; notes, review, AES-256-GCM National ID)
Phase 3  Lenders, Matching & Pricing                   DONE* (0004; rate cards, masked proposals, frozen quote)
Phase 4  Consent, Approval & Maker-Checker Disburse     DONE* (0005; immutable consent hash; maker != checker)
Phase 5  Servicing, Double-Entry Ledger & Cashier       DONE* (0006; balances, waterfall, reversals)
Phase 6  Documents, Notifications & Outbox              DONE* (0007; metadata + integrity hash; simulated outbox)
Phase 7  Hardening, Governance & Launch                 DONE* (MFA lifecycle (simulated codes), security audit log)
         * simulation/gated — live behaviour waits on the matching ADR + the release gate (§14)
```

---

## 5. Migration Sequence & Database Schema Roadmap

Forward-only, additive migrations in `workers/api/migrations/`. Never modify or rename an applied migration. **Next free number is `0009`** (`0008` is now the payment-reference unique index below; the two `0002_*` files are intentional).

| Migration File | Phase | Entities / Tables | Key Invariants |
| :--- | :--- | :--- | :--- |
| `0001_core.sql` | Sprint 1 | `agencies`, `users`, `loan_applications`, `idempotency_keys`, `audit_events` | FK on; positive pesewas; unique agency email; idempotency `(agency_id, key)` |
| `0002_origination_review.sql` | Sprint 2 | `application_notes`, `borrower_profiles`, review columns | FK to applications/users; internal-note checks; agency scoping |
| `0002_application_review.sql` | Sprint 2 | (companion review migration) | intentional second `0002_*` |
| `0003_security_remediation.sql` | Sprint 2 | `borrower_responses`, AES-256-GCM National ID columns | server-verifiable evidence; ciphertext+IV+tag+version; no plaintext |
| `0004_sprint3_lenders_matching_pricing.sql` | Sprint 3 | lenders, products, eligibility, matching runs, proposals, quote snapshots | bps check `0..10000`; integer pesewas; immutable quote hash; simulation tag |
| `0005_sprint4_consent_disbursement.sql` | Sprint 4 | `borrower_offers`, `borrower_consents`, `disbursement_records` | immutable terms hash; `maker_id != checker_id`; simulation mode |
| `0006_sprint5_servicing_ledger.sql` | Sprint 5 | accounts, journal entries/lines, loans, schedules, installments, cashier payments, reversals | `sum(debit)==sum(credit)`; waterfall; append-only reversals |
| `0007_sprint6_sprint7_docs_outbox_hardening.sql` | Sprint 6 & 7 | `document_records`, `outbox_events`, `mfa_configurations`, `security_audit_logs` | document integrity hash; outbox queue; MFA lifecycle; security audit |
| `0008_payment_reference_unique.sql` | Remediation (2026-11-03) | unique index on `cashier_payments(agency_id, reference)` | durable duplicate-payment guard (review finding #5) |
| `0009_*` (planned, S-04 / S-15) | — | negotiated-term fields; conditional maker/checker constraint | see S-04, S-15 |

---

## 6. Sprint Delivery History

All seven sprints are implemented and verified in simulation/gated mode. Live behaviour per sprint is gated on the matching ADR and the release gate (§14).

- **Sprint 1 — Foundation, Identity & Core Origination.** DONE. Migration `0001`. `/health`, `/auth/*`, `/applications`. Client `api-gidfine.ts`, `BorrowerLoanManager.tsx`, `AgencyReviewQueue.tsx`.
- **Sprint 2 — Origination & Agency Review.** DONE (incl. security remediation `0003`). AES-256-GCM National ID, server-verifiable borrower responses, internal notes; `reviewWorkflow.test.ts`.
- **Sprint 3 — Lenders, Matching & Pricing.** DONE (simulation). Lender onboarding, product catalogue, eligibility matching, PII-redacted proposal feed, deterministic quote with SHA-256 snapshot. Gated on O-03/04/05/06/08.
- **Sprint 4 — Consent, Approval & Maker-Checker Disbursement.** DONE (simulation; dual control enforced). Versioned offers, immutable consent hash, `maker_id != checker_id` (403 on violation), simulated disbursement adapter. Routes: `/applications/:id/offer`, `/applications/:id/consent`, `/disbursements/prepare`, `/disbursements/confirm`. Gated on O-02/09.
- **Sprint 5 — Servicing, Ledger & Cashier.** DONE (simulation). Chart of accounts, balanced journals, loans, schedules, waterfall allocation, compensating reversals. Gated on O-02/04/10.
- **Sprint 6 — Documents, Notifications & Outbox.** DONE (simulation). Document metadata + integrity hash, access scoping, transactional outbox with simulated dispatch. Gated on O-07/11/12.
- **Sprint 7 — Hardening, Governance & Launch prep.** DONE (simulation). MFA lifecycle (still accepts fixed test codes — defect, see S-06), security audit logs, health checks. Gated on O-13/14.

---

## 7. Cloudflare Resource Map

| Resource | Role | Status | Note |
| :--- | :--- | :--- | :--- |
| **Pages + Functions** | SPA + HTTP API, single origin | Active | Production boundary; no CORS complexity |
| **D1 (SQLite)** | Authoritative relational store | Active | Versioned migrations only |
| **KV** | Caching + short-lived idempotency | Available | Never authoritative financial truth |
| **R2** | Encrypted KYC + PDF storage | Deferred (Sprint 6 / S-17) | Needs O-07, O-12 |
| **Queues / Cron** | Outbox retries, overdue processing | Deferred | D1/in-memory outbox until volume justifies |
| **Durable Objects** | Realtime chat/collab | Not needed for MVP | Deferred |
| **Workers AI** | OCR / fraud scoring | Out of scope | Non-essential for MVP |

---

## 8. Legacy Code Retirement (Convex)

Convex files (`frontend/convex/*`, `frontend/src/services/loanService.ts`, fallback hooks in `LenderPortal.tsx`) remain only to prevent build breaks. They must not be extended and no new feature may read from them. Removal is step **S-03**. Milestones: Sprint 3 retires proposal queries; Sprint 4-5 cut loan/financial flows to the D1 ledger; the dedicated cleanup commit removes all Convex packages and directories.

---

## 9. Definition of Done (Quality Gates)

A requirement or phase is complete only when:
1. **Approval** — the owner decision (O-01..O-14) is recorded in writing with version, date, rationale (an Accepted ADR).
2. **Schema integrity** — migration is forward-only, tested, preserves FKs and integer pesewas.
3. **Authorization & privacy** — server-side object- and field-level controls enforced before serialization.
4. **Financial invariants** — double-entry balance, waterfall, maker-checker proven.
5. **Automated tests** — unit + integration pass in CI (`npm test`).
6. **Frontend experience** — loading, empty, permission-denied, error states handled.
7. **Documentation** — guides, runbooks, API specs synchronized (§16 protocol).

---

## 10. Authorisation

- **Authorised by:** Owner (Gidfine).
- **Recorded:** 2026-10-30 — first step-by-step, then extended the same day to the complete programme, A to Z.
- **Applies to:** AI agents, subagents and developers in this repository.
- **Scope:** finish every remaining item in §12. Nothing there needs a further engineering decision from the owner; the only things still required from owner or counsel are in §13 (*Externally gated*).

**What "complete" means:** every step in §12 is `DONE` with evidence and the release gate (§14) passes. A step is not done because code merged; it is done when its acceptance check runs green and its documentation is updated.

---

## 11. Safety floor & non-negotiables

**Safety floor — what authorisation cannot unlock.** Building toward these is authorised; turning them on is not, until the artefact exists and the matching ADR is `Accepted`:

1. Live borrower PII at commercial scale waits on counsel's privacy notice + consent wording (BLOCKERS C-2).
2. Live disbursement of real money waits on written confirmation each operating model sits inside the licence held (C-3).
3. Contract generation for signature waits on the legal operating-model annex (C-4); the renderer may be built and previewed before that.
4. Per-lender disclosure enablement waits on that lender's signed matrix (C-1); the profile machinery may be built before it.

**Non-negotiables:**

1. **No live money movement** while `disbursement_records.simulation_mode = 1` has not been cleared under the release gate.
2. **No live borrower PII at scale** before C-2.
3. **Never drop a database constraint to make code compile.** Relaxing `check_maker_checker_distinct` is a planned step (S-15) with a prerequisite, not a shortcut.
4. **No secrets in the repository** — not in TOML, `.env`, `.dev.vars`, tests or fixtures.
5. **Forward-only migrations, never renamed.** Next free number is `0009_`; new files only. The two `0002_*` files are intentional.
6. **Simulation flags stay until the matching ADR is `Accepted`.**
7. **"Negotiated" must become data** — typed, constrained fields, never free text.
8. **One step per commit**, with the documentation protocol (§16) applied.
9. **Authorization is enforced server-side**, never by a frontend guard alone.
10. **No capability published on the landing page or in marketing that the platform does not have.**

---

## 12. Remaining work — authorised steps

Status: `DONE` · `NEXT` · `AUTHORISED` · `SEQUENCED` (needs an earlier step) · `GATED` (needs an external artefact). IDs are stable; other documents reference them.

| ID | Work | Acceptance | Status |
| --- | --- | --- | --- |
| S-00 | Restore green worker typecheck | `npm run typecheck` exit 0; suite still green; no behaviour change | NEXT |
| S-01 | Pages Functions route parity for every worker route | automated check asserts a Pages entrypoint per `index.ts` route; `/lenders`, `/loans` return 401 not 404 | AUTHORISED |
| S-02 | `GET /loans/:id/schedule`, `/transactions`, `/outstanding` | tests cover ordering + outstanding balance; owner scoping matches `/loans/:id` | AUTHORISED |
| S-03 | Retire the Convex surface | zero `convex` under `frontend/src`; build passes; no feature loses a data source | SEQUENCED (S-01, S-02) |
| S-04 | Migration `0009`: negotiated-term fields | applies to fresh + current schema; defaults preserve simulation; check constraints present | AUTHORISED |
| S-05 | Pricing reads terms from data; both bases; round half up | any term change changes the snapshot hash; both bases in payload; round-half-up fixtures | SEQUENCED (S-04) |
| S-06 | Real TOTP MFA (replace fixed codes) | `123456`/`654321` rejected; valid window accepted; replay rejected; secret never returned | AUTHORISED |
| S-07 | Daily disbursement + cashier reconciliation reports | reconciles fixture payments/reversals to the journal; discrepancies surfaced | **IN PROGRESS** — disbursement report DONE (2026-11-04); cashier reconciliation pending |
| S-08 | CI: typecheck + tests + build; fix stale frontend tests | CI green on main, red on broken typecheck; no skipped tests | AUTHORISED |
| S-09 | Documentation and runbook sync | final pass reconciles API list, resource map, ADR statuses | CONTINUOUS |
| S-10 | Administrator impersonation (read-only, audited) | 9 tests green; pages entrypoint added | **DONE** |
| S-11 | Margin revenue posting on collection, multi-component | a payment posts each margin component; a reversal removes it; unpaid instalments post nothing | SEQUENCED (S-05) |
| S-12 | Matching and routing completion (hybrid, eligibility, 48h) | both modes modelled; placeholder proposals removed; eligibility respects disclosure profiles | SEQUENCED (S-05) |
| S-13 | Per-lender disclosure profile machinery, fail closed | lender with no profile gets empty payload; profile filters API **and** documents | AUTHORISED |
| S-14 | Product catalogue validation (bounds, frequency set, no early settlement) | invalid/unset rule cannot activate; settlement before maturity refused | SEQUENCED (S-04) |
| S-15 | Approval model: value-tiered single/dual + reconciliation control | reconciliation proves on fixtures **first**, then forward migration makes the constraint conditional on amount; role matrix enforced | SEQUENCED (S-07, S-14) — reversal segregation shipped |
| S-16 | Discrepancy escalation surface for reconciliation | unresolved discrepancy visible to auditor; cannot be silently closed | SEQUENCED (S-07) |
| S-17 | R2 private document storage, 5-year retention | upload/download scoped to staff/auditor/borrower; deletion job at 5 years with audit; key custody documented | AUTHORISED (build) / GATED (enable) |
| S-18 | Document renderer: offer, agreement, schedule, receipts, statements | renders from immutable snapshots; pluggable numbering; same disclosure filtering as APIs | SEQUENCED (S-13, S-17) |
| S-19 | Email + SMS adapters behind an interface | adapter tests green with a fake provider; retry ceiling; per-message cost; **disabled** until providers exist | AUTHORISED (build) |
| S-20 | Frontend completion: lender, cashier, agency portals on real endpoints | each handles loading/empty/error/permission-denied; no dead controls; keyboard reachable | SEQUENCED (S-01, S-02) |
| S-21 | Frontend design-token alignment | one token system across landing + app (light/dark) | AUTHORISED |
| S-22 | Observability, runbook, backup/restore drill | restore drill from a D1 export recorded; structured logs carry request ids, never PII | AUTHORISED |
| S-23 | Security review: cross-role leakage, enumeration, export leakage | findings with severity; nothing critical open | SEQUENCED (S-13, S-20) |
| S-24 | UAT pack and acceptance evidence | each §14-guide acceptance criterion has recorded pass/fail with evidence | SEQUENCED (S-15, S-23) |

### Detail on the steps that carry real risk

**S-00 — typecheck.** Errors cluster in `domain/pricingEngine.ts` (undefined-safety on indexed access), `routes/applications.ts` (D1 typing drift), and the test adapters (missing `withSession`). Pin behaviour with a characterization test before touching call sites; a typecheck fix must not change behaviour on financial code.

**S-15 — approval model.** Order is fixed: build the reconciliation report (S-07, disbursement half done), prove it on fixtures, then migrate. Relaxing the constraint first leaves a money path with no detective control. Owner approval covers the *model* (value-tiered; T a per-account setting; single approver when unset — ADR-0018); it does not authorise skipping this sequence. Reversal segregation (recorder ≠ reversal approver) is already shipped.

**S-17 — document storage.** Retention (5 years) and readers (staff, auditors, borrower; never a lender) are decided. Remaining design: encryption/key custody and the deletion procedure (BLOCKERS R-6). A store without a deletion path is a permanent PII liability, so both ship with the feature.

**S-19 — notifications.** Build adapters and cost accounting now; keep dispatch disabled until providers and an alert threshold exist (BLOCKERS R-4, R-5).

---

## 13. Externally gated — cannot be self-approved

| Item | Owner | Unblocks |
| --- | --- | --- |
| C-1 Per-lender signed disclosure matrices | Counsel | Enabling any lender profile (S-13 machinery buildable now) |
| C-2 Privacy notice + consent wording, processing register | Counsel | Live borrower PII (S-17, S-18 to real users) |
| C-3 Licence reference + per-model scope confirmation | Counsel / owner | Live disbursement, commercial launch |
| C-4 Legal operating-model annex, lender as payee | Counsel | Signable contracts from S-18 |
| R-8 Written accountant confirmation (VAT exemption) | Accountant | Invoicing / receipts |

Smaller owner answers still open (R-1 to R-10) are in the [blocker triage](./ADR/DECISIONS.md#blocker-triage) in `ADR/DECISIONS.md`; none blocks starting any step above.

---

## 14. Release gate — all true before real money or real PII

- [ ] S-00, S-01, S-02, S-06, S-08, S-15 complete with evidence
- [ ] S-07 reconciliation proven on fixtures and running daily
- [ ] C-1, C-2, C-3, C-4 recorded as **Accepted** in `ADR/DECISIONS.md`
- [ ] R-8 accountant confirmation recorded in ADR-0004
- [ ] S-23 security review signed, nothing critical open
- [ ] S-22 backup/restore drill recorded
- [ ] S-24 UAT evidence attached per acceptance criterion
- [ ] Owner sign-off recorded in [`ADR/DECISIONS.md`](./ADR/DECISIONS.md)
- [ ] Simulation flags removed only as part of the matching gate closure

---

## 15. Progress log

| Step | Status | Date | Evidence |
| --- | --- | --- | --- |
| S-00 | PENDING | — | baseline: typecheck error baseline, tests green |
| S-01 | PENDING | — | Pages entrypoints cover health/auth/applications/borrower/admin only |
| S-02 | PENDING | — | 3 client calls have no handler |
| S-03 | PENDING | — | convex references under frontend/src |
| S-04 | PENDING | — | latest migration is `0008`; negotiated-terms migration will be `0009` |
| S-05 | PENDING | — | `FLAT_SIMULATION` default, `rateBps = 2400` |
| S-06 | PENDING | — | MFA accepts `123456` / `654321` |
| S-07 | IN PROGRESS | 2026-11-04 | disbursement reconciliation report built (`GET /reports/disbursement-reconciliation`, read-only, supervisors; test in `sprints3to7.test.ts`); cashier reconciliation pending |
| S-08 | PENDING | — | no CI test/build gate; stale frontend test path |
| S-09 | CONTINUOUS | — | — |
| S-10 | DONE | 2026-10-30 | 9 new tests; UI not browser-verified |
| S-11 | PENDING | — | waterfall allocates, no margin revenue component |
| S-12 | PENDING | — | auto proposal placeholders in `matchingEngine.ts` |
| S-13 | PENDING | — | single mask shape via `createMaskedBorrowerSummary` |
| S-14 | PENDING | — | no catalogue bounds; no activation gate |
| S-15 | PENDING | 2026-11-03 | reversal segregation shipped (recorder ≠ reversal approver, 403); tier + conditional constraint still gated on S-07 + real MFA |
| S-16 | PENDING | — | no discrepancy surface |
| S-17 | PENDING | — | no `r2_buckets` binding |
| S-18 | PENDING | — | no PDF path |
| S-19 | PENDING | — | simulated delivery adapter |
| S-20 | PENDING | — | portals call some unrouted endpoints |
| S-21 | PENDING | — | landing hardcodes a dark palette beside the token system |
| S-22 | PENDING | — | no restore drill recorded |
| S-23 | PENDING | — | no pentest; disclosure tests only |
| S-24 | PENDING | — | no UAT evidence pack |

**Remediation (from [`DECISION_REVIEW.md`](./DECISION_REVIEW.md), 2026-11-03/04):** Phase 1 shipped — atomic financial writes (`db.batch`), payment-reference `UNIQUE` (migration `0008`), no fabricated lender on disbursement; plus reversal segregation and the daily disbursement reconciliation report. ADR-0016/0017/0018 directions decided (Provisional).

---

## 16. Documentation protocol — after every step

1. `CHANGELOG.md` — dated entry a newcomer can follow.
2. `AGENTS.md` work log — same heading, plus what was deliberately left undone.
3. The progress log in §15 — status, date, and the command/result.
4. Affected documents — API list, deployment guide, ADR when a gate closes, guide §15/§17 when a requirement changes.
5. **Evidence, not adjectives.** Paste the command and its result.

A step whose checks failed stays `IN PROGRESS` with the failure logged. Reporting a partial step as done is worse than reporting it unfinished.

---

## 17. Changing this plan

- Adding a step: append with acceptance criteria, then note it in `CHANGELOG.md`.
- Moving `GATED` → `AUTHORISED`: the artefact must be in the ADR **and** the ADR status updated, in that order.
- Removing a step: record why. Deleted scope and forgotten scope look identical to the next reader.
