# Gidfine Loan Agency Management Platform

**Product Requirements Document (PRD) & Development Guide | v1.4**

**Prepared for:** Gidfine / HiTrace Solutions delivery team

**Date:** 13 October 2026 · **Revision:** 30 October 2026 (owner decisions recorded)

**Status:** Requirements baseline. The business decisions previously listed in §15 are now recorded as owner decisions in [`ADR/`](./ADR/README.md); this guide describes the requirements, and each decision points at the record that fixed it.

**Implementation state:** Sprints 1-7 are implemented and every financial or third-party path runs in **simulation mode** pending the gate closures listed in [`BLOCKERS.md`](./BLOCKERS.md).

**Current platform baseline:** Cloudflare Pages + Pages Functions, React + Vite, D1 and KV. The Pages Functions reuse the TypeScript router in `workers/api/src`; there is no Python runtime. R2, Queues/Cron and Durable Objects are deferred capabilities, not current production dependencies.

**Companion documents:** [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) (phases, sprints, migration roadmap, definition of done) · [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md) (authorised steps and progress) · [`BLOCKERS.md`](./BLOCKERS.md) (what is answered, what is still open) · [`ADR/README.md`](./ADR/README.md) (decision records)

## 1. Executive summary

Gidfine is an intermediary between borrowers seeking loans and lenders supplying funds. Lenders state their pricing, and Gidfine applies its margin under whichever formula the deal uses — a spread, a markup on either side, a share of interest, or a combination (ADR-0004) — then presents borrower-facing terms. Gidfine controls lender matching, permitted disclosures, lender response, final agency approval, recording of disbursement and repayments, and event notifications. Lenders and borrowers must not receive restricted identity or contact information through any channel.

## 2. Objectives and boundaries

- Enable borrowers to register and submit loan requests online.
- Enable an agency operator to review requests and match them to eligible lenders.
- Capture lender-specific rates and calculate transparent borrower-facing pricing, total repayment and payment schedules.
- Require lender consent and separate final agency approval before activating a loan.
- Let agency administrators configure and enforce distinct lender and borrower visibility policies.
- Record disbursements and repayments with auditable history and notifications.
- Provide dashboards, statuses, audit trails and basic reporting.

**Not assumed in MVP:** direct lender-borrower messaging, automated credit scoring, payment gateway integration, automated collection/disbursement, mobile apps, guarantor handling, collections litigation or multi-currency lending. These require explicit approval.

**Reconciled with the recorded decisions:** Gidfine is a single-agency operator (ADR-0001) and an arranger, not a lender of record (ADR-0002). Competitive 1-to-many lender matching **is** in scope at launch (ADR-0008) — an earlier draft excluded "marketplace bidding", which contradicted that decision and has been removed.

## 3. User roles and authority

| Role | Primary actions | Restrictions |
| --- | --- | --- |
| Agency administrator (`agency_admin`) | Configures lender access, margins, users, approvals, loan products and disclosures; may view another account read-only through the audited impersonation flow | All sensitive actions audited; impersonated sessions cannot write (ADR-0015) |
| Agency loan officer (`loan_officer`) | Reviews applications, proposes lenders, manages assigned cases, may approve disbursement under the single-approver model | Approval and policy changes only as delegated (ADR-0009) |
| Underwriter (`underwriter`) | Assesses eligibility against lender product criteria | No payment, approval or policy authority |
| Lender (`lender`) | Receives proposals, reviews permitted information, accepts/declines | No direct borrower contacts, no KYC documents, no unapproved personal data |
| Borrower (`borrower`) | Registers, applies, accepts terms, monitors repayment status and receipts | Cannot view lender identities, costs or information unless disclosure policy enables it |
| Finance / cashier (`cashier`) | Records and reconciles disbursements and repayments; reconciles daily | Reversals need supervisor approval; cannot change approved loan terms (ADR-0009, ADR-0010) |
| Auditor / compliance (`auditor`) | Views approved audit and reconciliation evidence; may read KYC documents | Read-only, strictly scoped access (ADR-0007) |

Role identifiers in brackets are the values in the `users.role` column and the JWT `role` claim. There is no separate "platform administrator" role: the single-agency decision (ADR-0001) removed the SaaS layer, and any future multi-agency onboarding requires a superseding ADR.

## 4. End-to-end loan lifecycle

1. Borrower creates an account and submits an application with amount, purpose, tenure and required profile details.
2. Agency reviews the request and verifies required information; records reasons for holds or rejection.
3. Agency selects a lender and prepares a filtered proposal using permitted fields and approved pricing policy.
4. Lender accepts, declines or counters the proposal; a counteroffer returns to agency review.
5. Agency confirms lender agreement and performs final approval; final pricing and disclosures are generated.
6. Borrower reviews and affirmatively accepts final terms if not already accepted for the identical terms.
7. Authorised disbursement occurs and is recorded; repayment schedule becomes active only on confirmed funding date.
8. Cashier/system records verified repayments, allocates them by policy, updates balances and emits notifications.
9. Loan reaches paid-off/closed, overdue/restructured or other defined terminal state, with audit evidence.

## 5. Functional requirements — priority

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | Role-based registration, authentication, MFA for privileged users, approval and account recovery | Must |
| FR-02 | Borrower loan application with attachment handling, draft/submission and statuses | Must |
| FR-03 | Agency review queue, internal notes, assignment and validation | Must |
| FR-04 | Lender onboarding and rate/product/limit configuration | Must |
| FR-05 | Agency lender matching, controlled proposal and response workflow | Must |
| FR-06 | Agency margin policy, quote versioning and repayment schedule calculator | Must |
| FR-07 | Separate lender acceptance, agency approval and borrower final consent | Must |
| FR-08 | Field-level disclosure policies independently configured for lender and borrower views | Must |
| FR-09 | Disbursement confirmation with reference, dates, value; **single authorised approver plus a daily reconciliation report** (ADR-0009) | Must |
| FR-10 | Repayment entry, allocation, receipts, reversal and reconciliation | Must |
| FR-11 | Event notifications with templates, delivery log and retries | Must |
| FR-12 | Immutable financial event log and access/approval audit history | Must |
| FR-13 | Basic dashboards, loan ledger, aging and export with redaction enforcement | Should |
| FR-14 | Advanced payment integrations, mobile apps, credit scoring and automation | Later |

## 6. Interest, margin and repayment calculations

A lender supplies its rate and the agency defines its margin. The product must never infer whether a percentage is monthly, annual, flat, effective or reducing-balance; these are separate fields. Calculation policies must be versioned, and quote values frozen once accepted.

| Parameter | Meaning |
| --- | --- |
| P | Principal amount disbursed/financed |
| L | Lender interest rate, with rate basis and method |
| M | Agency margin, explicitly identified as percentage points or a separate fee |
| B | Borrower rate under approved pricing formula |
| n | Number of scheduled instalments |
| d | Payment frequency and first due date |

**Illustrative flat-interest model only (not an approved Gidfine pricing policy):** for a 12-month loan, lender annual flat rate L=18%, margin M=3 percentage points, borrower annual flat rate B=21%; if principal P=GHS 10,000, total simple interest = 10,000 × 0.21 × 12/12 = GHS 2,100; total repayments GHS 12,100; 12 monthly instalments ~GHS 1,008.33 with the final instalment adjusted to account for rounding. The lender amount, agency earnings, cash settlement method and tax/fee treatment require separate definitions.

For amortising / reducing-balance loans, where r is the effective rate per instalment and n is the number of equal instalments:

```text
payment = P × r / (1 − (1 + r)^(-n))  for r > 0
payment = P/n                         when r = 0
```

Rate conversion and irregular periods must be explicitly defined. Use decimal arithmetic, currency rounding rules, deterministic schedule generation and allocation rules. Never use floating-point binary values for money.

- Quote shows principal, lender pricing (agency-only), agency margin (agency-only by default), borrower rate, method, instalments, total repayable, fees and schedule.
- Offer and schedule retain a snapshot of all terms, consent version, rate bases and computation algorithm version.
- **Rounding (decided, ADR-0003):** round half up to the nearest pesewa, for both methods and every figure shown to a borrower or lender. Instalment schedules adjust the final instalment so the total matches exactly.
- **Margin (decided, ADR-0004):** any combination is allowed on one deal — a share of interest and/or a markup, on the lender side and/or the borrower side, flat or percentage. Revenue is recognised when cash is collected, not at disbursement. The margin is treated as VAT-exempt pending written accountant confirmation.
- **Early settlement (decided, ADR-0005):** not permitted before maturity. No rebate or penalty formula is implemented; the schedule runs to term.
- **Grace and late penalties (decided, ADR-0005):** configured per product, never globally. A null grace or penalty means none, never a hidden default. The maximum penalty rate is still open (BLOCKERS R-1).
- System supports configurable due dates, weekends, partial payments, overpayments and restructured loans only after the corresponding policy decision; none of these is live yet.
- All financial changes use ledger entries or compensating/reversal transactions; deleting payment history is prohibited.

## 7. Confidentiality and visibility controls

Agency defines disclosure policies independently for lenders and borrowers. Both APIs and UI must apply server-side object-level and field-level authorisation. Hidden fields must not appear in payloads, error messages, logs accessible to parties, PDFs, exports, searches or notifications. Pseudonymous case IDs may be used in lender-facing proposals. Decisions about documents, identity checks and legally mandated lender disclosures require legal review.

| Data field | Agency | Lender (default) | Borrower (default) |
| --- | --- | --- | --- |
| Borrower full name / phone / email | Full | Hidden | Own information |
| Borrower address / ID documents | Full under controls | Hidden | Own information |
| Borrower income / eligibility summary | Full | Sanitised summary only if enabled | Own submitted information |
| Loan amount / duration / intended use | Full | Assigned proposal only | Own application |
| Lender identity / contact | Full | Own identity | Hidden pending disclosure policy |
| Lender base rate | Full | Own proposed rate | Hidden by default |
| Borrower final rate / payment schedule | Full | Only if authorised | Visible before consent |
| Agency margin / earnings | Full | Hidden by default | Hidden by default subject to mandatory disclosures |
| Payment status / confirmed amounts | Full | Assigned loan limited view | Own loan details |

**Policy hierarchy:** legal and regulatory disclosure obligations override a configurable concealment setting. Deny by default. Agency changes to permissions require elevated approval, reason and immutable audit log. A lender must never be able to change policy themselves.

**Per-lender disclosure (decided, ADR-0006):** the attributes a lender may see come from that lender's own signed agreement, not from one global mask. A lender with no configured profile sees nothing — the filter fails closed. The lender-facing proposal feed returns a masked summary only, and notification payloads and generated documents must apply the same profile.

**KYC documents (decided, ADR-0007):** readable by agency staff, auditors and the borrower themselves; **never** by a lender. Retention is five years after the loan closes. Storage is not yet live — no document store is bound (BLOCKERS R-6).

## 8. Notifications and communication

| Event | Recipients | Trigger |
| --- | --- | --- |
| Application submitted | Borrower + agency | Submission committed |
| Application assigned | Assigned lender + agency | Proposal created |
| Lender accepts / declines / counters | Agency; lender acknowledgement | Lender decision committed |
| Agency approves / rejects | Borrower + relevant lender as permitted | Agency decision finalised |
| Final offer ready / borrower consents | Borrower; then agency | Offer published / consent recorded |
| Disbursement confirmed | Borrower + agency + permitted lender | Disbursement posted |
| Repayment posted / reversed | Borrower + agency + permitted lender | Ledger event committed |
| Upcoming / missed instalment | Borrower + agency (lender if permitted) | Scheduled job with consent and policy |
| Loan closed | Borrower + agency + permitted lender | Balance reconciled and closure approved |

**Channels (decided, ADR-0011):** in-app is the source of truth, with **email and SMS** as notification channels funded by Gidfine. WhatsApp is out of scope. There is no hard spend cap; send volume is monitored and abnormal spend triggers an alert. Use an asynchronous outbox with idempotency, a retry ceiling, non-sensitive message templates, event timestamps and delivery status. Never place hidden contact or identity data in a lender notification. Real provider adapters are not built yet (BLOCKERS R-5), so dispatch remains simulated.

## 9. Loan state model and control rules

Application statuses:

```text
DRAFT → SUBMITTED → UNDER_REVIEW → MATCHING → LENDER_PENDING →
LENDER_ACCEPTED → AGENCY_APPROVED → BORROWER_ACCEPTED →
PENDING_DISBURSEMENT → ACTIVE → PAID_OFF → CLOSED
```

Alternate transitions include `MORE_INFO_REQUIRED`, `LENDER_DECLINED`, `AGENCY_REJECTED`, `BORROWER_DECLINED`, `CANCELLED`, `EXPIRED`, `DELINQUENT` and `RESTRUCTURED`. Only permitted roles may trigger each transition.

- A lender decision cannot bypass agency approval; agency approval cannot substitute for necessary borrower consent.
- No active loan or repayment schedule without confirmed disbursement.
- Term changes after lender response require a newly versioned proposal and appropriate re-acceptances.
- A loan can be assigned to one active lender at a time unless syndicated funding is explicitly required.
- Reassignment, cancellation and reversal must be auditable; notifications must not be sent before the transaction commits.

## 10. Suggested screens

| Agency portal | Lender portal | Borrower portal |
| --- | --- | --- |
| Application inbox and filters | Assigned proposals | New loan application |
| Application detail and verification | Proposal detail (filtered) | Application tracking |
| Lender directory and rate cards | Accept/decline/counter | Offers and consent |
| Loan quotation/calculator | Assigned loan portfolio | Repayment schedule |
| Approval work queue | Permitted repayment status | Payment history and receipts |
| Disbursement / payment ledger | Notifications | Notifications |
| Visibility policy editor and audit log | Account settings | Profile and support |

## 11. Data model — shipped schema and remaining concepts

**Conceptual entities (original design):** `agencies/tenants`; `users`; `agency_memberships`; `roles/permissions`; `borrower_profiles`; `lender_profiles`; `lender_products`; `applications`; `application_documents`; `lender_assignments`; `lender_proposals`; `proposal_versions`; `interest_pricing_policies`; `borrower_offers`; `consents`; `loans`; `disbursements`; `repayment_schedules`; `repayment_installments`; `payment_transactions`; `payment_allocations`; `ledger_entries`; `notification_events`; `notification_deliveries`; `disclosure_policies`; `audit_events`.

**Shipped schema (migrations `0001`-`0007`):** `agencies`, `users`, `loan_applications`, `application_status_history`, `application_review_notes`, `application_notes`, `borrower_profiles`, `borrower_responses`, `lenders`, `lender_users`, `lender_products`, `product_eligibility_criteria`, `matching_runs`, `lender_proposals`, `proposal_versions`, `quote_snapshots`, `borrower_offers`, `borrower_consents`, `disbursement_records`, `accounts`, `journal_entries`, `journal_lines`, `loans`, `repayment_schedules`, `repayment_installments`, `cashier_payments`, `payment_reversals`, `document_records`, `outbox_events`, `mfa_configurations`, `idempotency_keys`, `audit_events`, `security_audit_logs`.

**Conceptual entities not yet shipped:** `application_documents` (metadata exists as `document_records`), `lender_assignments` (proposal rows carry the assignment), separate `pricing_policies` (terms live on products and quotes), `payment_allocations` (allocation is written into journal lines), `disclosure_policies` (per-lender profiles are a BLOCKERS R-item), `notifications` (delivery is `outbox_events`), `ledger_entries`/`journal_transactions` (superseded by `journal_entries` + `journal_lines`).

**Scoping:** every agency-owned record carries `agency_id`. Because the platform is single-agency (ADR-0001), there is no `tenant_id`; `agency_id` remains as defence in depth and as the migration path if a second agency is ever onboarded.

**Money types:** store amounts as `INTEGER` **pesewas** and rates as `INTEGER` **basis points**. Do not use `NUMERIC`/`DECIMAL` or floating point — an earlier draft of this section said otherwise and was wrong.

Associate every financial event with creator, approver (where necessary), source reference, event time and reversal linkage.

## 12. Security and compliance baselines

- Authenticate all actors; enable multi-factor authentication for financial approvals and privileged accounts. **Current state:** MFA enrolment and verification exist but the verifier still accepts fixed test codes (`123456`, `654321`). That is a defect to fix before any privileged flow goes live (EXECUTION_PLAN S-06); do not enable MFA-dependent controls on top of it.
- Enforce least privilege, field redaction and agency-controlled information disclosure on backend APIs.
- Encrypt transport and sensitive information at rest; secure backups; use short-lived credentials and secret management. National ID values are stored AES-256-GCM encrypted with ciphertext, IV, tag and version; no plaintext column exists.
- Maintain immutable or append-only audit evidence for rate changes, approvals, access policies and payment postings.
- Test object ID enumeration, cross-role leakage, export leakage and unauthorised bulk lookups. Tenant-escape testing is not applicable while single-agency (ADR-0001); cross-role leakage is covered by the disclosure tests.
- Apply incident response, retention, consent, data minimisation and subject-rights processes consistent with Ghana's Data Protection Act, 2012 (Act 843). Registration with the Data Protection Commission is held; the approved privacy notice text and consent wording are still outstanding (BLOCKERS C-2).
- Before launch, confirm in writing that each operating model sits inside the licence Gidfine holds, and record any interest or disclosure ceilings it imposes (ADR-0014, BLOCKERS C-3).
- Administrator impersonation is a read-only, audited, 15-minute session and never a path to write financial data (ADR-0015).

## 13. Technical architecture — current baseline and target

The deployed application uses React 19 + TypeScript + Vite on the Cloudflare Pages project `loan-engine`. Pages Functions provide the same-origin HTTP API and call the shared Worker router at `workers/api/src/index.ts`. The standalone Worker configuration remains useful for isolated API development, but the frontend does not depend on a separate API hostname in production.

Active infrastructure is Cloudflare D1 for relational records and Cloudflare KV for cache/idempotency support. Authentication uses Worker Web Crypto: PBKDF2-HMAC-SHA-256 password hashes and an application-issued HS256 JWT. Secrets are stored in Pages/Workers secret storage; they are never committed to the repository.

R2 is intentionally not required by the current routes. It becomes a delivery dependency only when the owners approve private document uploads, generated contracts or receipts. Durable Objects are also not implemented; they should be introduced only if a confirmed requirement needs per-entity coordination or live sessions. Queues/Cron, Workers AI and AI Gateway are future options, not launch prerequisites.

The target product still requires server-enforced roles, field-level disclosure, versioned pricing, guarded state transitions, append-only financial history, idempotent financial writes, audit evidence and automated security tests. The implementation order is defined in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

**Simulation gating.** Origination, matching, pricing, consent, disbursement, servicing and document metadata are implemented, but the financial and third-party edges are simulated and labelled as such: quotes carry `is_simulation = 1` and `status = 'PROVISIONAL'`, disbursements write `simulation_mode = 1`, payments accept only a manual cashier entry path, and outbox dispatch does not call any provider. A simulation flag may only be removed as part of closing the matching decision record — see [`BLOCKERS.md`](./BLOCKERS.md) and the per-record "Evidence in the codebase" sections in [`ADR/`](./ADR/README.md).

A shared-database multi-tenant model is appropriate only if Gidfine is intended to serve multiple independent agency businesses; if Gidfine alone is the agency, an agency-scoped single-tenant implementation may be simpler. Confirm commercial tenancy before schema design.

## 14. MVP delivery plan and acceptance tests

Phase numbering here is product-facing; [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §4 and §6 hold the binding phase and sprint breakdown, and [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md) holds what is authorised to be built next. Where the two disagree, the implementation plan wins.

| Phase | Key output | Acceptance evidence |
| --- | --- | --- |
| 0. Discovery | Approved policies, calculator examples, tenancy and legal decisions | Recorded in `ADR/` — done 2026-10-30, four counsel artefacts still outstanding |
| 1. Foundation | Accounts, roles, privacy rules, audit, tests | Unauthorised users denied API/exports |
| 2. Origination | Application submission and agency review | Borrower submits; agency sees queue |
| 3. Matching/pricing | Lender offer, margin, quote/versioning | Correct schedule and masked proposal |
| 4. Approval/disbursement | Lender accept, agency approve, borrower consent, funding confirmation | Invalid state transitions rejected |
| 5. Servicing | Ledger, payments, notifications and dashboards | Partial/late/reversed payments reconcile |
| 6. Hardening | Threat tests, UAT, training, backup/restore | Signed UAT and production checklist |

Representative acceptance criteria: (1) a lender cannot retrieve borrower phone number even by direct API request or export; (2) loan remains unapproved after lender acceptance; (3) the agency's approved final terms match the borrower's consent; (4) all instalments sum exactly to approved total under rounding policy; (5) duplicate payment submission cannot create duplicate credit; (6) an edited payment produces a reversal and new auditable entry; (7) an impersonated administrator cannot perform any state-changing request; (8) notification recipient data respects current and event-specific disclosure rules.

Criterion 7 replaces the former "an agency cannot access a different tenant's loans" test, which does not apply under the single-agency decision (ADR-0001). Cross-role leakage replaces cross-tenant leakage as the isolation test that matters.

## 15. Decisions register (closed 2026-10-30)

The fourteen questions this section previously listed are answered. Each answer
is recorded with its consequences in the referenced ADR; the residual items that
remain open are tracked in [`BLOCKERS.md`](./BLOCKERS.md) §3.

| # | Question | Gate | Answer | Record | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | One agency or multi-agency SaaS? | O-01 | **Single agency.** Gidfine operates for itself. | [0001](./ADR/0001-tenancy-model.md) | Accepted |
| 2 | Arrange only, or disburse/collect? Who is creditor and payee? | O-02 | **Arranger for every product at launch.** Contract is lender ↔ borrower; the lender is payee. | [0002](./ADR/0002-legal-operating-model.md) | Provisional (C-4) |
| 3 | Rates monthly or annual; flat, reducing or effective? | O-03 | **Both bases quoted side by side**; method chosen per deal; **round half up** to the pesewa. | [0003](./ADR/0003-interest-calculation-method.md) | Provisional (R-9) |
| 4 | Agency margin: spread, fee, interest share or combination? | O-04 | **Any combination**, on either side, flat or percentage; **recognised when cash is collected**; VAT-exempt. | [0004](./ADR/0004-agency-margin-and-revenue.md) | Provisional (R-8) |
| 5 | Exact instalments, or can they vary with funding and payment timing? | O-03/O-05 | Instalment amounts are **frozen in the quote and consent snapshot**; the schedule activates on the **confirmed funding value date**. | [0003](./ADR/0003-interest-calculation-method.md) | Provisional |
| 6 | Durations, frequencies, grace, penalties, early repayment? | O-05 | **Frequencies flexible; tenure uncapped; grace and penalties per product; early settlement not allowed.** | [0005](./ADR/0005-loan-product-parameters.md) | Provisional (R-1) |
| 7 | What borrower information must lenders lawfully receive? | O-06 | **Per-lender signed disclosure agreements**; no profile means no data. | [0006](./ADR/0006-lender-kyc-disclosures.md) | Provisional (C-1) |
| 8 | Must Gidfine collect and store KYC documents? Who may access them? | O-07 | **Five-year retention**; readable by agency staff, auditors and the borrower; **never a lender**. | [0007](./ADR/0007-document-retention-policy.md) | Provisional (R-6) |
| 9 | Accept/decline only or counter? One application to several lenders? | O-08 | **Hybrid**: competitive 1-to-many to all eligible lenders, 48-hour round, then sequential fallback. | [0008](./ADR/0008-lender-matching-workflow.md) | Provisional (R-2) |
| 10 | Who approves, changes a rate, records and reverses a payment? Dual authorisation? | O-09 | **Single approver** (`agency_admin` or `loan_officer`); cashier reversals need supervisor approval; **daily disbursement reconciliation is the compensating control**. | [0009](./ADR/0009-maker-checker-and-approvals.md) | Provisional (R-10 + migration) |
| 11 | Manual payment recording or provider integration? | O-10 | **Manual cashier entry only** at launch; daily supervisor reconciliation. | [0010](./ADR/0010-payment-collection-scope.md) | Provisional (R-7) |
| 12 | Which notification channels, and who pays? | O-11 | **In-app + email + SMS**, funded by Gidfine, **no hard cap (alerting instead)**; WhatsApp out. | [0011](./ADR/0011-notification-channels-and-budget.md) | Provisional (R-4, R-5) |
| 13 | Which documents must be generated? | O-12 | **Full set**: offer, credit agreement, schedule, receipts, statements; **click-to-accept plus terms hash is sufficient acceptance**. | [0012](./ADR/0012-generated-financial-documents.md) | Provisional (R-3) |
| 14 | What regulatory and licensing approvals are needed? | O-13, O-14 | **Data Protection Commission registration held**; **credit intermediation / moneylending licence held**. | [0013](./ADR/0013-data-protection-act-843.md), [0014](./ADR/0014-lending-regulatory-licensing.md) | Provisional (C-2, C-3) |

A "Provisional" record means the direction is decided and may be built to, but a
named artefact is still missing before it can be treated as final. Nothing in
this table authorises live money movement or live borrower PII at scale.

## 16. Change control

Product decisions are recorded as immutable decision records under [`ADR/`](./ADR/README.md), each with status, owner, date and rationale. A decision is never edited once accepted — it is superseded by a new record. The change process is:

1. Write the decision into its ADR (`Decision`, `Rationale`, `Decided by`, date) and set the status.
2. Update the index in [`ADR/README.md`](./ADR/README.md) and the status table in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §3.1.
3. Update §15 of this guide so the requirement and the record stay aligned.
4. Remove the corresponding simulation flags only once the record is Accepted.
5. Record each delivered step in `CHANGELOG.md` and the `AGENTS.md` work log.

Maintain the change log, feature backlog, API contracts and sample financial computation fixtures. Decisions that must not be reverted as incidental cleanup are listed under "Protected decisions" in [`AGENTS.md`](./AGENTS.md). Do not implement a new subsystem to bypass defects in the existing application; investigate and fix the underlying issue.

Where this guide and the implementation disagree, the code plus the ADR wins, and this guide is corrected in the same change.

---

## 17. Traceability — implementation plan to this guide

Every plan phase maps to a requirement section here and a decision record. If a
row's evidence is missing, the plan item is not done, whatever the sprint table
says.

| Plan item | Guide coverage | Decision record | Code | Test evidence |
| --- | --- | --- | --- | --- |
| Sprint 1 — identity, roles, audit | §3, §5 FR-01, FR-12, §12 | [0001](./ADR/0001-tenancy-model.md) | `workers/api/src/routes/auth.ts`, `lib/auth.ts`, `lib/encryption.ts`, `lib/audit.ts` | `tests/auth.test.ts`, `tests/releaseCandidate.test.ts` |
| Sprint 2 — origination and agency review | §4, §5 FR-02/FR-03, §9 | [0002](./ADR/0002-legal-operating-model.md) | `routes/applications.ts`, `routes/profile.ts`, `domain/stateMachine.ts`, migrations `0002`, `0003` | `tests/reviewWorkflow.test.ts`, `tests/stateMachine.test.ts`, `tests/integration.test.ts` |
| Sprint 3 — lenders, matching, pricing | §5 FR-04/FR-05/FR-06, §6 | [0003](./ADR/0003-interest-calculation-method.md), [0004](./ADR/0004-agency-margin-and-revenue.md), [0005](./ADR/0005-loan-product-parameters.md), [0006](./ADR/0006-lender-kyc-disclosures.md), [0008](./ADR/0008-lender-matching-workflow.md) | `domain/pricingEngine.ts`, `domain/matchingEngine.ts`, `routes/lenders.ts`, migration `0004` | `tests/sprints3to7.test.ts`, `tests/money.test.ts` |
| Sprint 4 — consent, approval, disbursement | §5 FR-07/FR-09, §9 | [0002](./ADR/0002-legal-operating-model.md), [0009](./ADR/0009-maker-checker-and-approvals.md) | `domain/consentWorkflow.ts`, `domain/makerCheckerDisbursement.ts`, `routes/offersAndDisbursements.ts`, migration `0005` | `tests/sprints3to7.test.ts` |
| Sprint 5 — servicing and double-entry ledger | §5 FR-10/FR-12, §6 | [0004](./ADR/0004-agency-margin-and-revenue.md), [0010](./ADR/0010-payment-collection-scope.md) | `domain/financialLedger.ts`, `routes/servicing.ts`, migration `0006` | `tests/sprints3to7.test.ts`, `tests/idempotency.test.ts` |
| Sprint 6 — documents and notifications | §5 FR-11, §8 | [0007](./ADR/0007-document-retention-policy.md), [0011](./ADR/0011-notification-channels-and-budget.md), [0012](./ADR/0012-generated-financial-documents.md) | `domain/documentsAndOutbox.ts`, `routes/documentsAndOutbox.ts`, migration `0007` | `tests/sprints3to7.test.ts` |
| Sprint 7 — hardening and governance | §12 | [0009](./ADR/0009-maker-checker-and-approvals.md), [0013](./ADR/0013-data-protection-act-843.md), [0015](./ADR/0015-administrator-impersonation.md) | `domain/hardeningMfa.ts`, `routes/hardening.ts`, `routes/impersonation.ts`, `lib/impersonationGuard.ts` | `tests/impersonation.test.ts`, `tests/sprints3to7.test.ts` |
| Plan §8 — Convex retirement | §13 conventions | — | not started (BLOCKERS E-4) | — |
| Plan §9 #5 — suite passes in CI | §12 | — | `.github/workflows/db-migrate.yml` only (E-6) | none |

### Requirements with no implementation yet

| Requirement | Source | Why it is not built | Owner of the fix |
| --- | --- | --- | --- |
| Real MFA (currently fixed codes `123456`/`654321`) | §5 FR-01, §12 | Security defect, not a gate | Engineering, S-06 |
| Attachment handling on applications | §5 FR-02 | No document store bound | BLOCKERS R-6 |
| Real email/SMS delivery and retry telemetry | §5 FR-11, §8 | Providers and budget owner not chosen | BLOCKERS R-4, R-5 |
| PDF generation: offer, agreement, schedule, receipts, statements | §5, §13 | Templates and numbering scheme not approved | BLOCKERS R-3 |
| Server-side export with redaction, aging report | §5 FR-13 | Not started | Engineering, unscheduled |
| Scheduled reminders and overdue sweep | §8, §13.1 B.12 | Cron/Queues deferred; no consumer exists | BLOCKERS R-5 |
| Visibility-policy editor screen | §7, §10 | Per-lender profiles are data, not a screen | BLOCKERS C-1 |
| Penetration audit and signed UAT | §14 phase 6 | Not performed | Owner, pre-launch |
| Cross-agency isolation tests | §11 (former wording) | Not applicable while single-agency | Superseded by ADR-0001 |

### Guide requirements deliberately out of scope

Direct lender-borrower messaging, automated credit scoring, guarantee handling,
collections litigation, multi-currency lending, mobile apps, provider payment
integration and WhatsApp remain excluded by §2 and are not scheduled in the plan.

### Technology Stack — Cloudflare (React + Vite + Pages Functions)

The Gidfine Loan Agency Management Platform is built and operated on **Cloudflare**. The single-page application is written in **React + TypeScript with Vite**. Production HTTP business logic runs in **Cloudflare Pages Functions**, which reuse the TypeScript Worker router in `workers/api/src`. There is no Python runtime in the product.

**Core Technology Stack:**

- **Frontend:** React 19 + TypeScript, built with Vite, hosted on **Cloudflare Pages**
- **Styling:** Tailwind CSS with reusable, accessible components
- **Edge API:** **Cloudflare Pages Functions** invoking the shared router from `workers/api/src`; the standalone `gidfine-api` Worker is retained for isolated development/testing
- **Database:** **Cloudflare D1** (SQLite), accessed only through Worker bindings
- **Cache/idempotency:** **Cloudflare KV**; use D1 for authoritative state
- **Authentication:** The active Pages Functions path uses application-issued HS256 JWT and PBKDF2-HMAC-SHA-256 password hashing through Web Crypto
- **Deployment:** Cloudflare Pages project `loan-engine`, Wrangler, and GitHub integration
- **Deferred capabilities:** R2 for private files, Queues/Cron for asynchronous work, Durable Objects for confirmed real-time coordination, and Workers AI/AI Gateway for approved AI workflows

**Development Requirements:**

All loan applications, lender matching, approvals, interest calculations, repayment processing, notifications and audit logging must be implemented as secure server-side endpoints backed by D1. The React client is never authoritative. R2 is required only for the document features that the owners approve.

The development team must:

1. Enforce role-based access control and strict tenant-level data isolation in the Worker.
2. Protect borrower and lender information through server-side authorization and field-level redaction before serialization.
3. Use D1 transactions (`batch` / `BEGIN … COMMIT`) or guarded conditional updates for financial operations.
4. Maintain append-only financial ledgers and comprehensive audit logs.
5. Use integer minor units (pesewas) for money and integer basis points for rates — never floating point.
6. Reuse existing React components and business rules rather than rewriting them.
7. Follow React, Vite, Workers and D1 best practices for security, scalability, maintainability and performance.

**Architecture Decision:** React + TypeScript + Cloudflare Pages/Pages Functions, D1 and KV are the current baseline. This replaces the previously proposed Vue, Laravel, PostgreSQL, Python/FastAPI and Convex runtimes. R2, Durable Objects, Queues/Cron and AI services remain gated by approved requirements. All functional requirements, security controls and business workflows defined in this document remain applicable.

### 13.1 Cloudflare Schema and Worker Conventions

All development must follow consistent schema, function, security and naming conventions.

#### A. D1 Schema Conventions

1. Define all tables and indexes in versioned SQL migrations under `workers/api/migrations/`; never mutate a production schema by hand.
2. Apply migrations with `wrangler d1 migrations apply` — forward-only, reviewed in version control, one logical change per migration.
3. Use `TEXT` primary keys generated server-side (ULID or UUID v7) for stable, sortable identifiers; never reuse business data as a key.
4. Use `snake_case` for columns and plural table names.
5. Define indexes for frequently filtered columns, including agency, application status, lender, borrower and creation date.
6. Include `agency_id` on every agency-owned table and enforce tenant isolation in the Worker query layer.
7. Maintain explicit `created_at`, `updated_at` and relevant business timestamps (ISO-8601 UTC strings or epoch milliseconds — pick one and apply it consistently).
8. Store monetary values as `INTEGER` **pesewas** (GH₵ 1.00 = 100 pesewas) and rates as `INTEGER` **basis points** (1% = 100 bps). Floating point is prohibited in financial paths.
9. Separate sensitive identity information, lender pricing, borrower offers and financial records according to access requirements.
10. Preserve financial history through append-only journal rows and compensating reversal rows; deleting or overwriting posted transactions is prohibited.
11. Enable `PRAGMA foreign_keys = ON` and declare `REFERENCES` constraints where the relationship is mandatory.

**Core tables:**

- `agencies`
- `users`
- `agency_memberships`
- `borrower_profiles`
- `lender_profiles`
- `lender_products`
- `loan_applications`
- `application_documents`
- `lender_assignments`
- `lender_proposals`
- `proposal_versions`
- `pricing_policies`
- `borrower_offers`
- `loan_consents`
- `loans`
- `disbursements`
- `repayment_schedules`
- `repayment_installments`
- `payment_transactions`
- `payment_allocations`
- `journal_transactions`
- `journal_lines`
- `ledger_entries`
- `disclosure_policies`
- `notifications`
- `audit_events`

These are conceptual tables and must be finalised against the approved product requirements.

#### B. Worker Module Conventions

Organise backend code by business domain rather than in a single entry file.

**Recommended structure:**

```text
workers/api/
├── wrangler.jsonc
├── migrations/
│   ├── 0001_core.sql
│   ├── 0002_proposals.sql
│   └── ...
└── src/
    ├── index.ts              # fetch handler, router, error mapping
    ├── routes/
    │   ├── auth.ts
    │   ├── applications.ts
    │   ├── proposals.ts
    │   ├── lender.ts
    │   ├── approvals.ts
    │   ├── documents.ts
    │   ├── ledger.ts
    │   └── admin.ts
    ├── domain/
    │   ├── stateMachine.ts
    │   ├── pricing.ts
    │   ├── underwriting.ts
    │   ├── fraud.ts
    │   └── allocation.ts
    ├── durable/
    │   └── loanSession.ts
    ├── jobs/
    │   ├── ocr.ts
    │   ├── notifications.ts
    │   └── overdueSweep.ts
    └── lib/
        ├── auth.ts
        ├── authorization.ts
        ├── tenantAccess.ts
        ├── disclosure.ts
        ├── money.ts
        ├── idempotency.ts
        ├── pdf.ts
        └── validators.ts
```

**Function Rules:**

1. **Queries** are `GET` handlers that never mutate state.
2. **Mutations** are `POST`/`PATCH` handlers that wrap their writes in a D1 transaction or a guarded conditional update.
3. **External calls** (lender APIs, model providers, email/SMS) run in Worker handlers or Queues consumers — never in the request path of a write that must stay transactional.
4. **Internal-only operations** are not routed publicly; keep them in `domain/` or `jobs/` and invoke them directly.
5. **Validation:** every public route validates its body and query parameters with an explicit schema before touching D1.
6. **Authorization:** every protected route independently verifies authentication, role permissions, record ownership and agency membership.
7. **Disclosure:** apply borrower and lender field-level disclosure rules before returning data. Never return sensitive records and rely on React to hide restricted fields.
8. **Business logic:** keep interest calculations, lender matching, approvals, repayment allocation and ledger rules in reusable domain modules.
9. **State transitions:** validate the current loan/application state and permitted transition via the central state machine before applying changes.
10. **Idempotency:** require an idempotency key for financial postings and webhook handlers; reject or replay deterministically on duplicates.
11. **Auditability:** record actor, action, timestamp, affected resource and before/after values for sensitive operations in `audit_events`.
12. **Scheduling:** use Cron Triggers and Queues for repayment reminders, overdue checks, OCR and other approved background workflows.
13. **Observability:** enable Workers Logs and structured JSON logging; never log tokens, document contents or full PII.

#### C. React and Worker Integration

- Put every server call behind the typed service layer in `frontend/src/services/`; components must not call `fetch` directly.
- Derive API and response types once in the service layer and reuse them across components.
- Use the API client and same-origin production routing; development may use `VITE_API_BASE` or `VITE_API_URL` for the local Worker.
- Do not add WebSocket or Durable Object code until a real-time requirement is approved and its deployment boundary is documented.
- Never expose backend secrets, administrative endpoints or unrestricted data access in frontend code.
- Handle loading, empty, error and permission-denied states consistently.
- Treat server redaction as authoritative: do not implement client-side "unhiding" of fields the API withheld.

#### D. Engineering Standards

Before introducing any new schema, route, component or subsystem, the development agent must inspect the existing implementation.

**Mandatory rules:**

- Reuse and extend existing code wherever practical.
- Fix underlying defects rather than building parallel functionality around them.
- Avoid duplicate tables, routes, business logic and unnecessary abstractions.
- Apply schema changes through controlled, backward-compatible migrations.
- Write automated tests for authorization, loan calculations, approvals, financial transactions and tenant isolation.
- Preserve existing functionality unless a change has been explicitly approved.
- Document important architectural decisions and business-rule changes.
- The retired Python implementation and its historical migration notes are removed from the active repository. Do not reintroduce a second backend runtime; extend the shared TypeScript router and Pages Functions boundary.
- The Convex prototype (`frontend/convex/*`, `frontend/src/services/loanService.ts`) is retired per [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §8. Removing it is EXECUTION_PLAN S-03; it must not be extended in the meantime, and no new feature may read from it.

**Critical Requirement:** the Cloudflare Worker is the authoritative backend for all Gidfine business operations. Financial calculations, approval workflows, access-control decisions and audit records must be validated and enforced server-side. React must never be the source of truth for financial or security-critical business logic.

*Internal working specification • Version 1.4 • 30 October 2026*
