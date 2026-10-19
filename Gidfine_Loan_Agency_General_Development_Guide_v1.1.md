# Gidfine Loan Agency Management Platform

**Product Requirements Document (PRD) & Development Guide | Draft v1.1**

**Prepared for:** Gidfine / HiTrace Solutions delivery team  
**Date:** 13 October 2026  
**Status:** Working draft — business decisions in Section 15 must be approved before implementation.

## 1. Executive summary

Gidfine is an intermediary between borrowers seeking loans and lenders supplying funds. Lenders state their pricing; Gidfine adds a margin and presents borrower-facing terms. Gidfine controls lender matching, permitted disclosures, lender response, final agency approval, recording of disbursement and repayments, and event notifications. Lenders and borrowers must not receive restricted identity or contact information through any channel.

## 2. Objectives and boundaries

- Enable borrowers to register and submit loan requests online.
- Enable an agency operator to review requests and match them to eligible lenders.
- Capture lender-specific rates and calculate transparent borrower-facing pricing, total repayment and payment schedules.
- Require lender consent and separate final agency approval before activating a loan.
- Let agency administrators configure and enforce distinct lender and borrower visibility policies.
- Record disbursements and repayments with auditable history and notifications.
- Provide dashboards, statuses, audit trails and basic reporting.

**Not assumed in MVP:** direct lender-borrower messaging, automated credit scoring, payment gateway integration, automated collection/disbursement, mobile apps, guarantor handling, collections litigation, multi-currency lending, or marketplace bidding. These require explicit approval.

## 3. User roles and authority

| Role | Primary actions | Restrictions |
| --- | --- | --- |
| Platform administrator (if SaaS) | Manages tenant subscriptions and technical operations | No routine access to borrower private data without a justified, audited support process |
| Agency administrator | Configures lender access, margins, users, approvals, loan products and disclosures | All sensitive actions audited |
| Agency loan officer | Reviews applications, proposes lenders, manages assigned cases | Approval and policy changes only if specifically delegated |
| Lender | Receives assigned proposals, reviews permitted information, accepts/declines or counters | No direct borrower contacts or unapproved personal data |
| Borrower | Registers, applies, accepts terms, monitors repayment status and receipts | Cannot view lender identities, costs or information unless agency enables it |
| Finance / cashier | Records and reconciles disbursements and repayments | Cannot change approved loan terms without authorised workflow |
| Auditor / compliance | Views approved audit and reconciliation evidence | Read-only, strictly scoped access |

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
| FR-09 | Disbursement confirmation with reference, dates, value and maker-checker option | Must |
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
- System supports configurable due dates, grace days, weekends, early settlement, partial payments, overpayments, late charges and restructured loans only after policy decisions.
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

In-app notification is core; email and SMS are configurable channels pending budget, consent and integration decisions. Use an asynchronous outbox/queue with idempotency, retries, non-sensitive message templates, event timestamps and delivery status. Never place hidden contact or identity data in a lender notification.

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

## 11. Conceptual data model

Core entities: `agencies/tenants`; `users`; `agency_memberships`; `roles/permissions`; `borrower_profiles`; `lender_profiles`; `lender_products`; `applications`; `application_documents`; `lender_assignments`; `lender_proposals`; `proposal_versions`; `interest_pricing_policies`; `borrower_offers`; `consents`; `loans`; `disbursements`; `repayment_schedules`; `repayment_installments`; `payment_transactions`; `payment_allocations`; `ledger_entries`; `notification_events`; `notification_deliveries`; `disclosure_policies`; `audit_events`.

All agency-owned records must carry `tenant_id` if implemented as SaaS. Enforce tenant scoping in queries, policies, background jobs, document storage and exports; use database constraints, indexes and tenancy isolation tests. Loan amounts, fees, rates and monetary ledger values must use appropriately sized `NUMERIC/DECIMAL` types. Associate every financial event with creator, approver (where necessary), source reference, event time and reversal linkage.

## 12. Security and compliance baselines

- Authenticate all actors; enable multi-factor authentication for financial approvals and privileged accounts.
- Enforce least privilege, field redaction and agency-controlled information disclosure on backend APIs.
- Encrypt transport and sensitive information at rest; secure backups; use short-lived credentials and secret management.
- Maintain immutable or append-only audit evidence for rate changes, approvals, access policies and payment postings.
- Test object ID enumeration, tenant escape, cross-role leakage, export leakage and unauthorised bulk lookups.
- Apply incident response, retention, consent, data minimisation and subject-rights processes consistent with Ghana’s Data Protection Act, 2012 (Act 843).
- Before launch, obtain Ghana-qualified advice on licensing, lending/credit intermediation, required borrower disclosures, pricing transparency, collections and the permitted role of the agency.

## 13. Suggested technical architecture (subject to repository audit)

Frontend: Vue 3 + TypeScript. Backend: Laravel API. Database: PostgreSQL. Queue/cache: Redis. Authentication: Laravel Sanctum or a verified alternative appropriate to the chosen deployment. Authorisation: policies and role permissions with explicit field-disclosure layer. Deployment: Docker/Coolify. Automated tests: backend integration/security tests, Vue component tests and end-to-end tests. This is a recommendation, not permission to replace a viable existing application.

A shared-database multi-tenant model is appropriate only if Gidfine is intended to serve multiple independent agency businesses; if Gidfine alone is the agency, an agency-scoped single-tenant implementation may be simpler. Confirm commercial tenancy before schema design.

## 14. MVP delivery plan and acceptance tests

| Phase | Key output | Acceptance evidence |
| --- | --- | --- |
| 0. Discovery | Approved policies, calculator examples, tenancy and legal decisions | Stakeholder sign-off |
| 1. Foundation | Accounts, roles, privacy rules, audit, tests | Unauthorised users denied API/exports |
| 2. Origination | Application submission and agency review | Borrower submits; agency sees queue |
| 3. Matching/pricing | Lender offer, margin, quote/versioning | Correct schedule and masked proposal |
| 4. Approval/disbursement | Lender accept, agency approve, borrower consent, funding confirmation | Invalid state transitions rejected |
| 5. Servicing | Ledger, payments, notifications and dashboards | Partial/late/reversed payments reconcile |
| 6. Hardening | Threat tests, UAT, training, backup/restore | Signed UAT and production checklist |

Representative acceptance criteria: (1) a lender cannot retrieve borrower phone number even by direct API request or export; (2) loan remains unapproved after lender acceptance; (3) the agency’s approved final terms match the borrower’s consent; (4) all instalments sum exactly to approved total under rounding policy; (5) duplicate payment webhook cannot create duplicate credit; (6) an edited payment produces a reversal and new auditable entry; (7) an agency cannot access a different tenant’s loans; (8) notification recipient data respects current and event-specific disclosure rules.

## 15. Decisions required from Gidfine before build

10. Is this application for Gidfine as one agency, or a SaaS used by multiple independent loan agencies?
11. Does Gidfine legally arrange loans only, or disburse/collect funds itself? Who is the contractual creditor and payee?
12. Are lender rates monthly or annual; flat, reducing-balance, effective annual or other?
13. Is the agency margin a percentage-point spread, fee, share of interest or a combination? Who receives which cashflows?
14. Are terms offered as exact instalment amounts, or can they vary with actual disbursement date and payment timing?
15. What durations, payment frequencies, grace rules, penalties and early repayment terms are allowed?
16. What borrower identity/credit information must lenders legally receive despite privacy preferences?
17. Must Gidfine collect, verify or store KYC documents? Who can access them?
18. Will lenders accept/decline only or also counteroffer; may Gidfine send one application to several lenders?
19. Who can approve a loan, change a rate, record a repayment and reverse a payment? Is dual authorisation required?
20. Will payments be manually recorded in MVP or integrated with mobile money, bank transfer or payment processor?
21. Which events use in-app, email, SMS or WhatsApp? Who pays notification costs?
22. What documents must be generated: disclosure, loan contract, amortisation schedule, receipt or statement?
23. What regulatory review and licensing approvals are needed for the intended Ghanaian operating model?

## 16. Change control

All assumptions in this v1.0 guide remain proposed until approved. Product decisions must be recorded with owner/date. Maintain change log, feature backlog, architectural decision records (ADRs), API contracts and sample financial computation fixtures. Do not implement a new subsystem to bypass defects in the existing application; investigate and fix the underlying issue.

---

*Internal working specification • Version 1.1 • 13 October 2026*
