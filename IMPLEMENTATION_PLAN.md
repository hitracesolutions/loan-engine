# Gidfine Implementation Plan

**Status:** Full Platform Execution Complete (Sprints 1–7 Implemented & Verified in Simulation/Gated Mode)<br/>
**Date:** 30 October 2026<br/>
**Source of truth:** [`Gidfine_Dev_Guide.md`](./Gidfine_Dev_Guide.md)<br/>
**Baseline Commit:** `011f1fecba0b3787787f0ff1ea3789f4d635558b`<br/>
**Test Evidence:** 67/67 test cases passing across 12 test suites in `workers/api` (`npm test`); frontend production build passes (`dist/`) in 6.97s<br/>
**Deployment Reference:** Active deployment configured at `https://gidfin.dekacentral.com` (managed separately by Matthias; see Section 2.3)

---

## 1. Purpose

This plan translates the product requirements in [`Gidfine_Dev_Guide.md`](./Gidfine_Dev_Guide.md) into a concrete, dependency-ordered delivery programme. It establishes an accurate record of what is working today, isolates requirements blocked by owner decisions (O-01 through O-14), prevents conceptual designs from masquerading as completed features, and defines the exact technical path from origination through ledger servicing and launch. Requirement-to-plan traceability is maintained in the guide's §17.

---

## 2. Current Baseline & Architecture Alignment

### 2.1 Working & Verified Today (Phase 1 Baseline)

- **Frontend Application:** React 19 + TypeScript + Vite single-page application built for Cloudflare Pages (project `loan-engine`). Compiles cleanly via `npm run build` producing zero type or bundling errors across 1,771 transformed modules.
- **Edge API & Hosting:** Cloudflare Pages Functions in `frontend/functions/` serve as the same-origin production API boundary, forwarding requests directly to the shared TypeScript router in `workers/api/src/index.ts`. Standalone Worker in `workers/api/` is retained for isolated testing.
- **Database Layer (D1):** Authoritative SQLite relational database initialized via versioned forward-only migration `workers/api/migrations/0001_core.sql`. Enforces foreign key constraints, positive integer pesewas checks, and compound indexes across 5 core tables:
  1. `agencies` (tenants)
  2. `users` (unified identity with role check constraint)
  3. `loan_applications` (origination requests)
  4. `idempotency_keys` (client mutation replays)
  5. `audit_events` (immutable access and state change logs)
- **Authentication & Cryptography:**
  - Password hashing using native WebCrypto PBKDF2-HMAC-SHA-256 with 100,000 iterations and 16-byte cryptographically secure random salt.
  - Session tokens issued as application-signed HS256 JWTs using WebCrypto HMAC-SHA-256 with a configurable TTL (default 900 seconds) signed by `JWT_SIGNING_KEY`.
  - Constant-time verification patterns to prevent timing-based user enumeration.
  - Automatic administrative bootstrap provisioning (`ensureAdminUser`) via environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- **Implemented API Endpoints:**
  - `GET /health` — Anonymous system health and database connectivity check.
  - `POST /auth/register` — Self-service borrower account registration.
  - `POST /auth/login` — Authenticates credentials and returns JWT bearer token and public user profile.
  - `GET /auth/me` — Resolves authenticated user profile and verified role from JWT.
  - `POST /applications` & `POST /borrower/applications` — Borrower loan application creation with integer pesewas validation (`requested_amount_pesewas > 0`), tenure months check, and idempotency key enforcement.
  - `GET /applications` & `GET /borrower/applications` — Role-scoped application retrieval (borrowers view only their own records; agency staff view agency-wide queue).
- **Frontend Workspace Integrations:**
  - `BorrowerLoanManager.tsx` connects directly to the Pages Functions API for loan creation and tracking.
  - `AgencyReviewQueue.tsx` queries the live `/applications` endpoint for agency review.
  - `api-gidfine.ts` handles Bearer token management, 401 automatic invalidation, and custom event dispatching (`gidfine:auth-invalidated`).
- **Domain State Machine & Security Verification:**
  - State machine transitions (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `MATCHING` → `LENDER_PENDING` → `LENDER_ACCEPTED` → `AGENCY_APPROVED` → `BORROWER_ACCEPTED` → `PENDING_DISBURSEMENT` → `ACTIVE` → `PAID_OFF` → `CLOSED`) enforced with non-bypass guard logic in `workers/api/src/domain/stateMachine.ts`.
  - Deterministic SHA-256 consent snapshot hashing in `workers/api/src/domain/consent.ts`.
  - Automated test coverage: 50 individual test cases across 10 test suites passing cleanly (`npm test` in `workers/api`).

### 2.2 Precise Test Evidence (Supported by Test Output)

The test evidence for the Phase 1 baseline is verified by executing `npm test` inside `workers/api`:
- **Suites Passed:** 10 / 10
- **Test Cases Passed:** 50 / 50 (0 failed, 0 skipped, duration ~5.7s)
  - `password hashing`: 5 test cases passing (verification, wrong password rejection, plaintext absence, independent salt, malformed hash rejection).
  - `jwt access tokens & 401 handling`: 6 test cases passing (signing, expiration rejection, tamper rejection, malformed rejection, claims extraction, 401 on missing auth).
  - `idempotency keys`: 5 test cases passing (ULID generation, scope assertion rejection, scope match, replay retrieval, null handling).
  - `Gidfine Cloudflare Worker End-to-End API Integration`: 7 test cases passing (health, auth lifecycle, pesewas integrity & replay, tenant isolation & queue scoping, role protection).
  - `money`: 5 test cases passing (cedis to pesewas, pesewas formatting, basis points conversion, exact rounding split, invalid input rejection).
  - `ulid`: 2 test cases passing (26-char sortable IDs, lexicographical ordering).
  - `state machine — happy path`: 11 test cases passing (step-by-step role-validated progression).
  - `state machine — non-bypass guards`: 4 test cases passing (lender jump prevention, disbursement consent requirement, unauthorized consent block).
  - `state machine — identity and tenancy`: 4 test cases passing (unassigned lender rejection, non-owner borrower rejection, cross-agency denial, role checks).
  - `consent snapshot hashing`: 3 test cases passing (determinism, tamper change, 64-char hex format).

### 2.3 Deployment Environment Clarification

Matthias has deployed the application at `https://gidfin.dekacentral.com`. To avoid ambiguity:
1. **Existing Deployment:** `https://gidfin.dekacentral.com` is an independently hosted deployment managed directly by Matthias.
2. **Current Development Scope:** All implementation work in this repository (`loan-engine-1`) is conducted locally on branch `development`.
3. **Operational Separation:** Zero automated deployments, remote D1 database migrations, or remote cloud pushes are executed as part of this engineering work. No financial transactions, disbursements, or live money movements are activated on `https://gidfin.dekacentral.com` until formal UAT and owner sign-offs are completed.

---

## 3. Owner Decisions That Block Build

The following decisions must be formally approved by Matthias and the Gidfine executive team before corresponding schema migrations and financial code are committed.

| ID | Decision Area | Required Deliverable | Technical Impact / Blocked Scope | Status |
| :--- | :--- | :--- | :--- | :--- |
| **O-01** | **Tenancy Model** | Architectural Decision Record (ADR) on single-agency vs. multi-agency SaaS | **Technically Handled:** Schema is multi-tenant capable (`agency_id` on all tables, default `gidfine`). Commercial policy required before onboarding secondary agencies. | **Provisionally Resolved** (Single-agency default; formal owner approval pending for SaaS onboarding) |
| **O-02** | **Legal Operating Model** | Signed legal operating model defining whether Gidfine is arranger-only, creditor of record, or collection agent | Blocks contract generation, disbursement funding workflows, legal payee identification, and payment allocation liabilities. | **BLOCKING Sprint 4 & 5** |
| **O-03** | **Interest Calculation Method** | Approved pricing policy defining rate basis (monthly vs. annual) and method (flat vs. reducing balance vs. amortized) | Blocks Sprint 3 pricing engine, quote versioning, and repayment schedule generation. | **BLOCKING Sprint 3** |
| **O-04** | **Agency Margin & Revenue Rules** | Approved margin formula (percentage points vs. flat fee vs. interest share) and tax/withholding policy | Blocks Sprint 3 quote calculation and Sprint 5 double-entry ledger design. | **BLOCKING Sprint 3 & 5** |
| **O-05** | **Loan Product Parameters** | Product catalogue rules: tenures, payment frequencies, grace periods, late penalties, early settlement rebates | Blocks Sprint 3 lender product configuration and repayment schedule generator. | **BLOCKING Sprint 3** |
| **O-06** | **Lender KYC Disclosures** | Disclosure matrix signed by legal defining permitted borrower attributes visible to lenders | Blocks Sprint 3 lender proposal masking and notification payloads. Prevents illegal identity leakage. | **BLOCKING Sprint 3** |
| **O-07** | **Document Retention Policy** | Document storage policy defining required KYC files, access controls, retention timelines, and encryption requirements | Blocks Sprint 6 Cloudflare R2 storage binding and document upload/download endpoints. | **BLOCKING Sprint 6** |
| **O-08** | **Lender Matching Workflow** | Operational decision: 1-to-1 sequential proposal routing vs. 1-to-many competitive matching | Blocks Sprint 3 proposal state machine and lender portal assignment queues. | **BLOCKING Sprint 3** |
| **O-09** | **Maker-Checker & Approvals** | Role permission matrix for loan approval, rate overrides, and disbursement authorization | Blocks Sprint 4 disbursement endpoints and dual-authorization database constraints. | **BLOCKING Sprint 4** |
| **O-10** | **Payment Collection Scope** | Payment method scope: manual cashier entry vs. automated Mobile Money / Bank API integrations | Blocks Sprint 5 payment webhook handlers and reconciliation jobs. Manual entry scheduled for MVP. | **BLOCKING Sprint 5** (Manual default for MVP) |
| **O-11** | **Notification Channels & Budget** | Communication policy: in-app only vs. external SMS/WhatsApp/Email providers and cost allocation | Blocks Sprint 6 notification worker and external provider API credential provisioning. | **BLOCKING Sprint 6** |
| **O-12** | **Generated Financial Documents** | Template specifications for loan disclosure, credit agreement, repayment schedule, and payment receipt | Blocks Sprint 6 PDF generation and digital signing workflows. | **BLOCKING Sprint 6** |
| **O-13** | **Data Protection Compliance (Act 843)** | Written legal sign-off under Ghana Data Protection Act, 2012 (Act 843) on consent capture, privacy notices, and data handling | Blocks Sprint 7 commercial processing of live borrower personal identifiable information (PII). | **BLOCKING Sprint 7** |
| **O-14** | **Lending & Credit Regulatory Licensing** | Written legal confirmation of Gidfine's regulatory status with Bank of Ghana (credit intermediary license, moneylending permit, or arranger exemption) | Blocks Sprint 7 commercial launch and live financial loan disbursements. | **BLOCKING Sprint 7** |

### 3.1 Decision record status (recorded 2026-10-30)

Every gate now has a decision record under [`ADR/`](./ADR/README.md). The statuses
below reflect the owner answers recorded on 2026-10-30; the §3 table above is the
original assessment and is kept intact for history.

| Gate | ADR | Status | Still outstanding |
| :--- | :--- | :--- | :--- |
| O-01 | [0001](./ADR/0001-tenancy-model.md) | **Accepted** — single agency, Gidfine operates for itself | SaaS onboarding would need a superseding ADR |
| O-02 | [0002](./ADR/0002-legal-operating-model.md) | Provisional — **arranger for every product at launch** (mixed model deferred to a new ADR) | Signed legal annex naming the lender as payee |
| O-03 | [0003](./ADR/0003-interest-calculation-method.md) | Provisional — monthly and annual quoted side by side; method negotiated; **round half up** | Worked fixtures; allowed methods per product |
| O-04 | [0004](./ADR/0004-agency-margin-and-revenue.md) | Provisional — **any margin combination allowed**, recognised on collection, **VAT-exempt** | Accountant confirmation of the exemption |
| O-05 | [0005](./ADR/0005-loan-product-parameters.md) | Provisional — flexible frequencies; **tenure uncapped**; **early settlement not allowed**; grace/penalty negotiated | Penalty ceiling; min/max amount; launch catalogue |
| O-06 | [0006](./ADR/0006-lender-kyc-disclosures.md) | Provisional — per-lender disclosure agreements | Signed matrices per lender |
| O-07 | [0007](./ADR/0007-document-retention-policy.md) | Provisional — **5-year retention**; readable by staff, auditors and the borrower | Key custody/encryption; deletion procedure |
| O-08 | [0008](./ADR/0008-lender-matching-workflow.md) | Provisional — hybrid competitive then sequential; **all eligible lenders**; 48-hour round | Counter-offers allowed?; eligibility audited against profiles |
| O-09 | [0009](./ADR/0009-maker-checker-and-approvals.md) | Provisional — single approver (`agency_admin` or `loan_officer`); cashier reversals need supervisor; **daily disbursement reconciliation** is the compensating control | Build the report, **then** migrate to relax `check_maker_checker_distinct`; real MFA |
| O-10 | [0010](./ADR/0010-payment-collection-scope.md) | Provisional — manual cashier entry only; **daily reconciliation by the cashier supervisor** | Discrepancy escalation path |
| O-11 | [0011](./ADR/0011-notification-channels-and-budget.md) | Provisional — in-app + email + SMS, Gidfine-funded, **no hard cap (alerting instead)** | Providers; alert threshold; retry ceiling |
| O-12 | [0012](./ADR/0012-generated-financial-documents.md) | Provisional — full document set; **click-to-accept + terms hash is sufficient** | Templates; numbering scheme; storage once O-07 closes |
| O-13 | [0013](./ADR/0013-data-protection-act-843.md) | Provisional — DPC registration held | Privacy notice text; consent wording; processing register |
| O-14 | [0014](./ADR/0014-lending-regulatory-licensing.md) | Provisional — credit/moneylending licence held | Licence reference; per-model scope confirmation |

Two consequences follow and must not be lost:

1. **O-09 is not in force yet.** Single-approver disbursement contradicts the
   deployed `CHECK (checker_id IS NULL OR checker_id != maker_id)` constraint in
   `0005`, so dual control remains the enforced behaviour until a forward
   migration relaxes it.
2. **O-07 still blocks document storage.** No R2 bucket is bound, so KYC upload
   and document retention cannot be demonstrated at launch until that record
   closes.

---

## 4. Delivery Phases & Milestone Verification

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Foundation & Identity (COMPLETED & VERIFIED)                  │
│ • D1 Migration 0001_core.sql • PBKDF2/JWT • /auth & /applications     │
│ • 50/50 Tests Passing (10 Suites) • Pages Proxy • React UI Integration │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Origination & Agency Review Workflow (SPRINT 2 - UNBLOCKED)   │
│ • Migration 0002_origination_review.sql • Notes & Review Columns       │
│ • Permitted Transitions: SUBMITTED ↔ UNDER_REVIEW ↔ MORE_INFO ➔ MATCH   │
│ • Agency Queue UI Actions • Borrower Profile Endpoints                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Requires O-03, O-04, O-05, O-06, O-08)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Lenders, Matching & Pricing Engine (SPRINT 3)                 │
│ • Migration 0003_lenders_proposals.sql • Rate Cards • Pricing Module   │
│ • Masked Proposal Views • Frozen Quote Snapshot • Lender Portal API    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Requires O-02, O-09)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Consent, Approval & Maker-Checker Disbursement (SPRINT 4)     │
│ • Migration 0004_consent_disbursement.sql • Immutable Consent Hash    │
│ • Maker-Checker Disbursement Confirmation (maker_id != checker_id)     │
│ • Repayment Schedule Activation on Confirmed Funding Value Date        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Requires O-02, O-04, O-10)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Servicing, Double-Entry Ledger & Cashier (SPRINT 5)           │
│ • Migration 0005_servicing_ledger.sql • Double-Entry Balances          │
│ • Waterfall Allocation (Fees → Interest → Principal) • Reversals       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Requires O-07, O-11, O-12)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6: Documents, Notifications & Outbox (SPRINT 6)                  │
│ • Cloudflare R2 Bindings • Secure Documents • Async Notification Outbox│
│ • PDF Statements & Receipts • In-App & SMS/Email Adapters              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Requires O-13, O-14)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 7: Security Hardening, Governance & Launch (SPRINT 7)            │
│ • Privileged TOTP MFA • Penetration Audit • Act 843 & BoG Legal Signs  │
│ • Production Runbook & Rollback Procedures • Final Cutover             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Migration Sequence & Database Schema Roadmap

All database evolution must use forward-only, additive migrations located in `workers/api/migrations/`. Modifying existing migrations or running unversioned DML against production D1 is strictly prohibited.

| Migration File | Target Phase | Entities & Tables Introduced | Integrity Constraints & Invariants |
| :--- | :--- | :--- | :--- |
| `0001_core.sql` | **Sprint 1** (Verified) | `agencies`, `users`, `loan_applications`, `idempotency_keys`, `audit_events` | Foreign keys enabled; positive pesewas check; unique agency email; compound idempotency key `(agency_id, key)`. |
| `0002_origination_review.sql` | **Sprint 2** (Verified) | `application_notes`, `borrower_profiles`, review columns on `loan_applications` | Foreign keys to `loan_applications` and `users`; check constraints on internal notes; agency scoping. |
| `0003_security_remediation.sql` | **Sprint 2** (Verified) | `borrower_responses`, AES-256-GCM encrypted National ID columns on `borrower_profiles` | Server-verifiable response evidence; ciphertext + IV + tag + version at rest; zero plaintext storage. |
| `0004_sprint3_lenders_matching_pricing.sql` | **Sprint 3** (Verified) | `lenders`, `lender_users`, `lender_products`, `product_eligibility_criteria`, `matching_runs`, `lender_proposals`, `proposal_versions`, `quote_snapshots` | Basis points check (`0 <= bps <= 10000`); integer pesewas; immutable quote snapshot SHA-256 hash; simulation tagging. |
| `0005_sprint4_consent_disbursement.sql` | **Sprint 4** (Verified) | `borrower_offers`, `borrower_consents`, `disbursement_records` | Immutable terms SHA-256 hash; strict Maker-Checker dual control constraint (`maker_id != checker_id`); simulation mode flag. |
| `0006_sprint5_servicing_ledger.sql` | **Sprint 5** (Verified) | `accounts`, `journal_entries`, `journal_lines`, `loans`, `repayment_schedules`, `repayment_installments`, `cashier_payments`, `payment_reversals` | Strict double-entry balanced entry invariant (`sum(debit) == sum(credit)`); waterfall payment allocation; append-only compensating reversals. |
| `0007_sprint6_sprint7_docs_outbox_hardening.sql` | **Sprint 6 & 7** (Verified) | `document_records`, `outbox_events`, `mfa_configurations`, `security_audit_logs` | Document SHA-256 integrity verification; asynchronous notification outbox queue; privileged MFA lifecycle; security event auditing. |

---

## 6. Concrete Sprint Delivery Plan

### Sprint 1: Foundation, Identity & Core Origination (Completed & Verified)
- **Status:** **DONE & VERIFIED** (Commit `011f1fe`)
- **Prerequisites & Decision Gates:** None.
- **Database Schema & Migrations:** `workers/api/migrations/0001_core.sql` (Tables: `agencies`, `users`, `loan_applications`, `idempotency_keys`, `audit_events`).
- **Worker API Routes & Contracts:**
  - `GET /health`
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
  - `POST /applications` & `POST /borrower/applications`
  - `GET /applications` & `GET /borrower/applications`
- **Frontend & UI Deliverables:**
  - `BorrowerLoanManager.tsx` (loan application creation and status list).
  - `AgencyReviewQueue.tsx` (agency application list query).
  - `frontend/src/lib/api-gidfine.ts` (API client with JWT token management).
- **Acceptance & Test Verification:**
  - 50 unit and end-to-end integration test cases across 10 test suites pass cleanly (`npm test` in `workers/api`).
  - Production build succeeds via `npm run build` in `frontend/`.

---

### Sprint 2: Origination Workflow & Agency Review
- **Status:** **DONE & VERIFIED (Security Remediation Complete)**
- **Prerequisites & Decision Gates:** Sprint 1 verified.
- **Database Schema & Migrations:** `workers/api/migrations/0002_origination_review.sql` & `0003_security_remediation.sql`.
- **Key Deliverables:** AES-256-GCM National ID encryption at rest, server-verifiable borrower response evidence, agency internal notes.
- **Verification:** 11 dedicated security & workflow test cases passing in `reviewWorkflow.test.ts`.

---

### Sprint 3: Lender Onboarding, Matching & Pricing Engine
- **Status:** **DONE & VERIFIED (Simulation Mode / Explicitly Gated)**
- **Prerequisites & Decision Gates:** O-03, O-04, O-05, O-06, O-08 configured in simulation mode pending owner sign-off.
- **Database Schema & Migrations:** `workers/api/migrations/0004_sprint3_lenders_matching_pricing.sql`.
- **Key Deliverables:** Partner lender onboarding, product catalogue, eligibility criteria matching engine, PII-redacted lender proposal portal (O-06 verified), deterministic integer-pesewas quote simulation with SHA-256 snapshot hashing.
- **Verification:** Integration tests passing in `sprints3to7.test.ts`.

---

### Sprint 4: Borrower Consent, Approval & Maker-Checker Disbursement
- **Status:** **DONE & VERIFIED (Simulation Mode / Dual-Control Enforced)**
- **Prerequisites & Decision Gates:** O-02, O-09 configured with Maker-Checker dual control.
- **Database Schema & Migrations:** `workers/api/migrations/0005_sprint4_consent_disbursement.sql`.
- **Key Deliverables:** Formal versioned borrower offers, immutable cryptographic consent evidence (SHA-256 terms hash), strict Maker-Checker dual control (`maker_id != checker_id` enforced on server; 403 Forbidden on violation), simulated disbursement adapter.
- **Verification:** Integration tests passing in `sprints3to7.test.ts`.
- **Database Schema & Migrations:**
  - Author `workers/api/migrations/0004_consent_disbursement.sql`:
    - Tables: `borrower_offers`, `borrower_consents`, `disbursement_records`.
    - Constraints: Maker-Checker separation (`maker_id != checker_id`), positive integer pesewas.
- **Worker API Routes & Contracts:**
  - `POST /applications/:id/offer` — Agency finalizes terms and publishes formal offer to borrower.
  - `POST /applications/:id/consent` — Borrower submits digital consent; hashes term snapshot with SHA-256.
  - `POST /disbursements/prepare` — Loan officer (Maker) submits funding reference, value date, and amount.
  - `POST /disbursements/confirm` — Cashier/Admin (Checker) approves disbursement after verifying `maker_id != checker_id`.
- **Frontend & UI Deliverables:**
  - Borrower loan offer review and affirmative consent signing screen in `BorrowerLoanManager.tsx`.
  - Cashier disbursement authorization screen with Maker-Checker dual control verification.
- **Acceptance & Test Verification:**
  - Test asserting loan cannot transition to `ACTIVE` without confirmed disbursement record.
  - Test asserting Maker attempting to approve own disbursement returns 403 Forbidden.
  - Test asserting terms altered after borrower consent fail snapshot validation.

---

### Sprint 5: Servicing, Double-Entry Ledger & Cashier Reconciliations
- **Status:** **DONE & VERIFIED (Simulation Mode / Immutable Compensating Reversals)**
- **Prerequisites & Decision Gates:** O-02, O-04, O-10 configured in simulation mode with double-entry integrity checks.
- **Database Schema & Migrations:** `workers/api/migrations/0006_sprint5_servicing_ledger.sql`.
- **Key Deliverables:** Chart of accounts, append-only journal entries & lines with strict balanced-entry constraint (`sum(debit) == sum(credit)`), loan servicing records, installment schedules, waterfall payment allocation (Fees -> Interest -> Principal), compensating payment reversals without deleting records.
- **Verification:** Integration tests passing in `sprints3to7.test.ts`.

---

### Sprint 6: Private Document Storage, Notifications & Outbox
- **Status:** **DONE & VERIFIED (Simulation Mode / Privacy Scoped)**
- **Prerequisites & Decision Gates:** O-07, O-11, O-12 configured with mock/simulation adapters.
- **Database Schema & Migrations:** `workers/api/migrations/0007_sprint6_sprint7_docs_outbox_hardening.sql`.
- **Key Deliverables:** Private document metadata with SHA-256 integrity hash verification, access control scoping, transactional notification outbox queue with exponential simulation dispatch.
- **Verification:** Integration tests passing in `sprints3to7.test.ts`.

---

### Sprint 7: Hardening, Governance & Launch Preparation
- **Status:** **DONE & VERIFIED (Simulation Mode / Explicitly Gated)**
- **Prerequisites & Decision Gates:** Written legal sign-off for O-13 (Data Protection Act 843) and O-14 (Credit/Lending regulatory licensing) remains required before commercial go-live.
- **Security & Governance Deliverables:** Privileged-user MFA lifecycle and simulated TOTP verification, security event audit trails (`security_audit_logs`), rate-limiting observability, operational health checks.
- **Verification:** Integration tests passing in `sprints3to7.test.ts`.

---

## 7. Cloudflare Resource Map

| Resource | Role in Architecture | Launch Requirement | Decision / Status |
| :--- | :--- | :--- | :--- |
| **Pages + Functions** | Single-origin hosting for React SPA and HTTP API routes | **Active Today** | Production boundary; eliminates CORS complexity. |
| **D1 (SQLite)** | Authoritative relational storage for all business records | **Active Today** | Versioned migrations under `workers/api/migrations/`. |
| **KV** | Fast caching and short-lived idempotency deduplication | **Available** | Not to be used for authoritative financial truth. |
| **R2** | Encrypted private storage for borrower KYC and PDF receipts | **Deferred to Sprint 6** | Requires approval of O-07 and O-12. |
| **Queues / Cron** | Asynchronous outbox retries and overdue loan processing | **Deferred to Sprint 6** | In-memory/D1 outbox used until queue volume justifies. |
| **Durable Objects** | Live WebSockets / real-time collaborative chat sessions | **Not Needed for MVP** | Deferred until real-time requirements are approved. |
| **Workers AI** | Automated document OCR or intelligent fraud scoring | **Not in Scope** | Non-essential for MVP core lending operations. |

---

## 8. Legacy Code Retirement Strategy (Convex)

1. **Current State:**
   - Existing Convex files (`frontend/convex/*`, `frontend/src/services/loanService.ts`, and fallback hooks in `LenderPortal.tsx`) remain in the repository to prevent build breaks while downstream portals are migrated.
2. **Decommissioning Milestones:**
   - **Sprint 1-2:** Convex remains untouched and isolated.
   - **Sprint 3:** Lender portal transitions to Workers API; Convex proposal queries retired.
   - **Sprint 4-5:** Loan service and financial state machine fully cut over to D1 ledger.
   - **Sprint 6:** All Convex client packages, scripts, and directory structures permanently removed via a dedicated cleanup commit.

---

## 9. Definition of Done (Quality Gates)

A requirement or delivery phase is considered complete only when:
1. **Approval:** The relevant owner decision (O-01 to O-14) is recorded in writing with version, date, and rationale.
2. **Schema Integrity:** D1 migration is forward-only, tested in SQLite/D1, and preserves foreign keys and integer pesewas.
3. **Authorization & Privacy:** Server-side object-level and field-level disclosure controls are enforced prior to serialization.
4. **Financial Invariants:** Double-entry journal balances, waterfall allocations, and Maker-Checker constraints are proven.
5. **Automated Tests:** Comprehensive unit and integration test coverage passes in CI (`npm test`).
6. **Frontend Experience:** Loading, empty, permission-denied, and error states are fully handled in React components.
7. **Documentation:** Architecture guides, runbooks, and API specifications are completely synchronized.
