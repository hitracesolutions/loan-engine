# GIDFINE — PHASE 4 READINESS REVIEW: FINANCIAL LEDGER & DUAL-AUTHORIZATION DISBURSEMENT

**Repository:** `hitracesolutions/loan-engine`  
**Branch:** `development`  
**HEAD Commit:** `afb4323 feat: initialize Convex backend foundation`  
**Specification:** `Gidfine_Dev_Guide.md` v1.1  
**Architecture Stack:** React 19 + TypeScript + Convex (Convex Auth)  
**Date:** October 21, 2026  
**Status:** PLANNING & READINESS AUDIT COMPLETE (Zero code changes made; awaiting approval)

---

## 1. Repository-State Verification

Before proceeding with Phase 4 planning, a comprehensive verification of the local repository was performed:

* **Active Branch & HEAD:**
  * Current branch: `development`.
  * HEAD commit: `afb4323 feat: initialize Convex backend foundation`.
  * Tracking status: Synchronized with `origin/development`.
* **Recent Commit History:**
  * `afb4323` — `feat: initialize Convex backend foundation`
  * `ec023d2` — `Rename Gidfine_Loan_Agency_General_Development_Guide_v1.1.md to Gidfine_Dev_Guide.md`
  * `8d49975` — `edits reqs`
  * `b4a488f` — `added the dev guide for the project`
  * `7059684` — `docs: archive VUE_MIGRATION_PLAN.md into migration directory`
* **Untouched `main` Branch:**
  * `main` remains at commit `f7ed8d1 docs: redesign README for better web presentation`.
  * `git diff main origin/main` returned zero output. The `main` branch has never been modified, committed to, or pushed.
* **Physical Verification of Phase 1 - 3C Changes:**
  * **Phase 1 (Schema & State Machine):** Present in `frontend/convex/schema.ts` and `frontend/convex/lib/stateMachine.ts`.
  * **Phase 2 (Mutations & Guards):** Present in `frontend/convex/loans.ts` (`submitApplication`, `proposeTerms`, `decideLenderProposal`, `approveOffer`, `recordConsent`, `checkDisbursementReadiness`).
  * **Phase 3A (Borrower & Agency UI):** Present in `frontend/src/components/workspace/BorrowerLoanManager.tsx`, `AgencyReviewQueue.tsx`, and `frontend/src/services/loanService.ts`.
  * **Phase 3B (Lender Portal):** Present in `frontend/src/components/LenderPortal.tsx` and `getLenderProposals`.
  * **Phase 3C (Security Audit & Test Suites):** Confirmed with 30/30 Node unit tests passing, 6/6 Python regression tests passing, and 0 TypeScript build errors.
* **Python Backend Preservation:**
  * All existing FastAPI endpoints and models in `api/`, `db/`, and `tests/` remain intact.

---

## 2. Review of Existing Financial Data Structures

An audit of existing schema and mutations was conducted to identify financial primitives and gaps:

| Component | Current Implementation | Status / Gap for Phase 4 |
|---|---|---|
| **Financial Ledger** | Does **NOT** exist. No general ledger or sub-ledger tables exist in Convex. | Must be designed in Phase 4 as an auditable, append-only journal. |
| **Monetary Precision** | Stored strictly as **integer minor units (pesewas)** (`principalPesewas`, `proposedAmountPesewas`, `requestedAmountPesewas`). 1 GHS = 100 pesewas. | Preserved. Floating-point numbers are prohibited. |
| **Rates & Margins** | Stored strictly as **integer basis points** (`lenderBaseRateBps`, `agencyMarginBps`, `borrowerRateBps`). 1% = 100 bps. | Preserved. Prevents rounding errors during quotation. |
| **Approved Terms Protection** | Proposals use revision versioning (`version: nextVersion`) and automatic superseding. Final agreements store an immutable SHA-256 fingerprint snapshot (`termsSnapshotHash`) in `consents`. | Established and verified. Prevents retroactive tampering of agreed terms. |
| **Disbursement Representation** | Only a read-only audit check exists (`checkDisbursementReadiness`). Returns `readyForDisbursement: boolean` with explicit lockouts (`paymentInitiated: false`, `fundingConfirmed: false`, `repaymentScheduleActive: false`). | **Missing:** Formal disbursement recording, dual-authorization approval, and funding confirmation date. |
| **Repayments & Allocations** | **Zero implementation.** No payment receipt, allocation waterfall, or arrears tracking exists. | Must be planned without inventing unresolved business policy. |
| **Audit Events** | Recorded via append-only `auditLogs` table (`agencyId`, `actorId`, `action`, `resource`, `details`, `timestamp`). | Working and tested across 5 milestones. Phase 4 will emit events for disbursement and ledger entries. |
| **Duplicate Prevention** | Governed by state machine guards (e.g. non-pending proposals cannot be decided). | **Missing:** Transaction-level idempotency keys to prevent network double-posting. |

---

## 3. Append-Only Financial Ledger Design

To satisfy Gidfine PRD Sections 6, 7, and 11, the ledger must follow an **immutable append-only journal model**:

### 3.1. Proposed Schema Additions (`frontend/convex/schema.ts`)

```typescript
// Immutable Financial Journal
ledgerEntries: defineTable({
  agencyId: v.id("agencies"),                    // Multi-tenant isolation boundary
  applicationId: v.id("applications"),          // Associated loan case
  entryReference: v.string(),                    // Human-readable reference: "TX-ACC-202610-000456"
  idempotencyKey: v.string(),                    // Client/network idempotency token
  entryType: v.union(
    v.literal("DISBURSEMENT_PRINCIPAL"),         // Fund release to borrower
    v.literal("REPAYMENT_COLLECTION"),           // Borrower payment received
    v.literal("FEE_ASSESSMENT"),                 // Upfront/processing fee applied
    v.literal("REVERSAL_COMPENSATION")           // Compensating entry for error correction
  ),
  direction: v.union(v.literal("DEBIT"), v.literal("CREDIT")),
  amountPesewas: v.number(),                     // Positive integer in minor units
  currency: v.literal("GHS"),
  status: v.union(
    v.literal("RECORDED"),
    v.literal("SETTLED"),
    v.literal("REVERSED")
  ),
  isReversed: v.boolean(),                       // Flagged when a compensating entry is posted
  reversalEntryId: v.optional(v.id("ledgerEntries")), // Links to compensating reversal record
  externalReference: v.optional(v.string()),     // Bank transfer slip / MoMo transaction ID
  makerId: v.id("users"),                        // Cashier/staff who entered transaction
  checkerId: v.optional(v.id("users")),          // Authorizing staff member
  notes: v.optional(v.string()),
  postedAt: v.number(),
  effectiveDate: v.number(),
})
  .index("by_agency", ["agencyId"])
  .index("by_application", ["applicationId"])
  .index("by_idempotency", ["agencyId", "idempotencyKey"])
  .index("by_entry_reference", ["entryReference"]),
```

### 3.2. Core Ledger Invariants
1. **Never Delete or Overwrite History:** Physical deletion or patching of financial ledger amounts is strictly prohibited. Error correction is handled exclusively through compensating reversal entries (`REVERSAL_COMPENSATION`) that balance out prior debit/credits and reference the original record.
2. **Deterministic Idempotency:** Mutations verify `by_idempotency` index before executing. If an identical `idempotencyKey` exists within the tenant, the mutation returns the existing record rather than double-posting.
3. **Transaction Consistency:** Convex mutations run as serializable, ACID database transactions. Concurrent writes to the same loan case are serialized by Convex's optimistic concurrency control.
4. **Tenant-Scoped Authorization:** All queries filter by verified `user.agencyId`. Cashiers can record entries; only agency admins and auditors can view full ledger balances. Lenders see only their assigned loan settlement ledger.

---

## 4. Dual-Authorization Disbursement Workflow

To ensure fiduciary safety under Ghanaian banking norms, disbursements must use a **Maker-Checker workflow**:

```
[Borrower Consented: BORROWER_ACCEPTED]
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Maker Initiates: requestDisbursementHandler          │
│    - Actor: Cashier or Loan Officer                     │
│    - Verifies: checkDisbursementReadiness               │
│    - Confirms: Funding channel, payout account, amount  │
│    - Inserts: disbursementRequests (PENDING_APPROVAL)   │
└─────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Checker Authorizes: approveDisbursementHandler       │
│    - Actor: Agency Admin or Underwriter                 │
│    - INVARIANT: Checker != Maker (No self-approval)     │
│    - Re-verifies: Consent hash and proposal status      │
│    - Updates: disbursementRequests (APPROVED)           │
│    - Advances Application: PENDING_DISBURSEMENT         │
└─────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Maker Finalizes: recordDisbursementSettlementHandler │
│    - Actor: Cashier                                     │
│    - Inputs: Confirmed bank/MoMo transaction reference  │
│    - Inserts: ledgerEntries (DISBURSEMENT_PRINCIPAL)    │
│    - Advances Application: ACTIVE                       │
│    - Confirmed funding date sets repayment start date   │
└─────────────────────────────────────────────────────────┘
```

### Key Safety Invariants:
* **Anti-Self-Approval:** The mutation explicitly enforces: `if (request.makerId === actor._id) throw new Error("FORBIDDEN: Dual-authorization violation: Maker cannot self-approve disbursement.")`.
* **Terms Stale Protection:** The request references the `termsSnapshotHash`. If any term or proposal was altered between request and approval, the check immediately halts.
* **No Real Payment Initiation:** The system records verified external confirmations; it does not connect to bank APIs or MoMo gateways in this phase (consistent with Gidfine MVP scope).

---

## 5. Repayment Allocation Analysis & Unresolved Business Decisions

Section 6 and Section 15 of `Gidfine_Dev_Guide.md` identify multiple critical financial decisions that remain unresolved by Gidfine stakeholders:

1. **Repayment Allocation Waterfall Policy:**
   * When a payment is recorded, in what order are funds applied?
     * Standard order A: Arrears Fees $\rightarrow$ Past-due Interest $\rightarrow$ Current Interest $\rightarrow$ Principal?
     * Standard order B: Principal-first?
     * How is the agency margin split from the lender interest at the collection level?
2. **Interest Calculation Engine:**
   * Gidfine Section 6 explicitly states: *"Illustrative flat-interest model only (not an approved Gidfine pricing policy)... product must never infer whether a percentage is monthly, annual, flat, effective or reducing-balance; these are separate fields."*
   * Reducing-balance vs. Flat-rate calculation cannot be hardcoded without stakeholder signoff.
3. **Overpayment & Early Settlement Rules:**
   * Does an early settlement rebate interest? What prepayment penalty rules apply?

### Recommended Architecture:
Do **NOT** hardcode an arbitrary allocation waterfall. Instead, Phase 4 will implement:
* An unallocated payment receipt ledger (`repayments` table).
* A modular, parameter-driven allocation handler that separates payment recording from schedule application, allowing stakeholders to plug in their approved waterfall formula without database restructuring.

---

## 6. Authentication & Deployment Dependencies

The following prerequisites require Matthias’s involvement before Convex Cloud can run live:

1. **Convex Cloud Project Provisioning:**
   * Matthias must execute `npx convex dev` or `npx convex deploy` to link the repository to a Convex Cloud project.
   * Generate `VITE_CONVEX_URL` and set it in `.env.local`.
2. **Convex Auth Provider Deployment:**
   * Configure production JWT issuer and JWKS in `frontend/convex/auth.config.ts`.
   * Add `@convex-dev/auth` or configure Clerk/Auth0 domain if external OIDC is selected.
3. **No Mock Credentials:**
   * The local checkout remains clean and avoids speculative or fake authentication providers.

---

## 7. Phased Implementation Plan for Phase 4

```
Phase 4A: Financial Ledger Schema & Idempotency Foundation
├── Add ledgerEntries, disbursementRequests, and repayments tables to schema.ts
├── Add idempotency index and reference generator
└── Update mock database fixtures for ledger tables

Phase 4B: Dual-Authorization Disbursement Backend
├── Implement requestDisbursement mutation (Cashier maker)
├── Implement approveDisbursement mutation (Admin checker, anti-self-approval)
├── Implement recordDisbursementSettlement mutation (Posts to ledger, activates loan)
└── State machine transition: BORROWER_ACCEPTED -> PENDING_DISBURSEMENT -> ACTIVE

Phase 4C: Compensating Reversals & Read-Only Auditing
├── Implement reverseLedgerEntry mutation (Maker-checker compensating debit/credit)
├── Implement getApplicationLedger query (Role-based transaction history)
└── Implement getAgencyFinancialOverview query (Disbursement & collection metrics)

Phase 4D: Repayment Receipt Recording
├── Implement recordRepayment mutation (Cashier receipt entry with external reference)
└── Implement flexible allocation stub (Awaiting waterfall policy approval)

Phase 4E: UI Integration
├── Create CashierDisbursementManager.tsx (Maker-checker dashboard)
├── Create LoanLedgerView.tsx (Append-only journal component)
└── Mount Cashier & Ledger tabs in AdminDashboard.tsx

Phase 4F: Test Suite & Verification
├── Concurrency & duplicate-execution tests
├── Maker-checker anti-self-approval tests
├── Reversal compensation tests
└── Full production build & Python regression runs
```

---

## 8. Current Action Item
**No files have been modified, committed, pushed, or deployed.**  
The repository remains clean on branch `development` with all 30 Phase 3 tests and 6 Python tests passing.  
Awaiting your review and explicit approval to proceed with Phase 4 implementation.
