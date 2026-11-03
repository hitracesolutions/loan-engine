# Decision & code review — financial controls

**Date:** 2026-11-03
**Reviewer lenses:** backend-design (security-discipline, data-modeling, migration-safety, idempotency-and-side-effects, auth-and-authorization), data-protection/privacy, adversarial fraud/controls.
**Scope:** the owner decisions in [`ADR/DECISIONS.md`](./ADR/DECISIONS.md), cross-checked against the shipped servicing, ledger and disbursement code.
**Status:** advisory. No ADR was modified. Per the repo's own rule, changing a decision means **superseding** its record, not editing it. Code-level findings are ordinary defects and can be fixed without an ADR.

Each finding says whether it was **confirmed against code** or is **decision-level** (argued from the records, not the implementation).

## Severity summary

| # | Severity | Finding | Type | Refs |
| --- | --- | --- | --- | --- |
| 1 | **High** | Financial writes are not atomic — no transaction/`batch()` around multi-statement money operations | Confirmed | ledger, disbursement |
| 2 | **High** | ADR-0002 (Gidfine holds no funds; lender is payee) contradicts ADR-0010 (cashier takes `CASH`) | Decision | ADR-0002, ADR-0010 |
| 3 | **High** | "Fail closed" disclosure must gate *matching*, not just field-masking | Decision | ADR-0006, ADR-0008 |
| 4 | **Med-High** | Single-approver disbursement removes the only preventive control; an admin can both record and reverse a payment | Confirmed + decision | ADR-0009 |
| 5 | **Medium** | `cashier_payments.reference` has no DB `UNIQUE` constraint; duplicate guard is app-level check-then-act | Confirmed | ADR-0010 |
| 6 | **Medium** | Lender disclosure is assessed field-by-field; re-identification is combinatorial | Decision | ADR-0006 |
| 7 | **Medium** | Document key-custody has a two-sided failure (operator can read PII vs lost keys fail retention) | Decision | ADR-0007 |
| 8 | **Low-Med** | Disbursement fabricates a "Default Partner Bank" lender inline | Confirmed | ADR-0002 |
| 9 | **Low (forward)** | When margin/revenue (ADR-0004) is built, reversal must also invert recognised margin | Decision | ADR-0004 |

A note on rounding (originally flagged, now cleared): principal splitting pushes the remainder into the final part (`workers/api/src/lib/money.ts:54-66`) so schedules reconcile, and reversals restore the exact stored component allocations (`workers/api/src/domain/financialLedger.ts:386-453`). Both are correct. The one unverified spot is interest rounding inside `pricingEngine.ts`.

---

## 1. Financial writes are not atomic — High (confirmed)

`processCashierPayment` (`workers/api/src/domain/financialLedger.ts:231-315`), `reverseCashierPayment` (`:411-475`) and `confirmDisbursement` (`workers/api/src/domain/makerCheckerDisbursement.ts:174-320`) each perform many sequential `db.prepare(...).run()` calls — journal entry, journal lines, the payment/loan row, balance updates, schedule + N installments, audit — with **no transaction or `db.batch()`**.

If the worker is evicted or any statement throws mid-sequence, the database is left in a partial state: a loan with no balancing journal entry, a `DISBURSED` record with no loan, or updated balances with no receipt. This is made more likely by the `journal_entries` `UNIQUE(agency_id, entry_number)` constraint (migration `0006:40`): `entry_number` is derived with `SELECT max(entry_number)+1` (`financialLedger.ts:63-79`), so two concurrent postings compute the same number, one `INSERT` fails — and without a transaction the already-executed writes from that path are **not rolled back**.

**Recommendation:** wrap each money operation in a single `db.batch([...])` (D1's atomic unit) so all rows commit or none do. Keep `entry_number` allocation and its dependent writes inside the same batch, and handle the uniqueness collision as a retry.

## 2. Who holds the funds — ADR-0002 vs ADR-0010 — High (decision)

ADR-0002 fixes the arranger model: *"Gidfine does not hold funds, and the legal payee for repayments is the lender."* ADR-0010 has repayments *"recorded by an authorised cashier"* accepting `CASH` (`servicing.ts:95-130`). A cashier taking physical cash means Gidfine **is** handling funds at the point of receipt — the exact trust-account/licensing exposure ADR-0002 adopts the arranger model to avoid, and which ADR-0014 licensing scope would have to cover.

**Recommendation:** resolve the model explicitly. Either the cashier collects strictly as the lender's disclosed agent (document it; the receipt must name the lender as payee), or acknowledge Gidfine handles client funds and bring ADR-0014's licensed scope and a trust-account control into play. This is an owner/counsel decision, not a code change.

## 3. "Fail closed" must gate matching, not just fields — High (decision)

ADR-0006 fails closed on *fields*; ADR-0008 exposes a competitive application to *"every eligible lender."* If eligibility is computed before the disclosure-profile check, a lender with **no profile** can still be matched in and learn the application exists. Field-masking a lender who should not be in the match set at all is the wrong layer.

**Recommendation:** exclude no-profile lenders from the match set entirely (not merely mask their view), and **version the disclosure profile**, stamping the version on each issued proposal the way consent stamps its terms hash — otherwise a later profile edit makes past disclosures unauditable.

## 4. Single-approver disbursement + admin record-and-reverse — Med-High (confirmed + decision)

Today disbursement enforces dual control: `confirmDisbursement` rejects `maker_id === checkerId` (`makerCheckerDisbursement.ts:167`). ADR-0009 would **relax** this to a single approver, leaving only a *next-day* reconciliation report — a detective control that fires after the money has left. Separately, the same person can both create and destroy a payment: `recordPayment` allows `cashier` **or** `agency_admin` (`servicing.ts:96`) and `reversePayment` requires `agency_admin` (`servicing.ts:133`), so an admin can record a receipt and reverse it alone. (Reason text and an audit event are required — `financialLedger.ts:461-475` — which is good, but it is still one actor.)

**Recommendation:** make disbursement approval **value-tiered** (single approver under a threshold, dual above), and when the maker/checker migration lands make `check_maker_checker_distinct` **conditional on amount** rather than dropping it — dropping forfeits the ability to require dual control for large loans later. For reversals, keep them off the record-er's own hands or require supervisor sign-off, per ADR-0009's own cashier rule, applied to admins too.

## 5. No DB uniqueness on payment reference — Medium (confirmed)

`processCashierPayment` guards duplicates with `SELECT id FROM cashier_payments WHERE agency_id=? AND reference=?` then inserts (`financialLedger.ts:134-141`), but `cashier_payments` has **no `UNIQUE(agency_id, reference)`** (migration `0006:117-133` — only a `(agency_id, loan_id)` index). The guard is therefore check-then-act with no database backstop: two concurrent requests with the same reference can both pass the `SELECT`. ADR-0010 also mis-describes this control as *"the existing idempotency key mechanism"* — the idempotency-keys table (`lib/idempotency.ts`) is keyed on a client `Idempotency-Key`, which is a different mechanism from reference-uniqueness, and the code comment labelling the reference check an "Idempotency guard" repeats the confusion.

**Recommendation:** add `UNIQUE(agency_id, reference)` to `cashier_payments` (forward migration) and let the `INSERT` enforce it; correct the ADR-0010 wording to say "payment-reference uniqueness," not "idempotency key."

## 6. Combinatorial re-identification — Medium (decision)

ADR-0006 evaluates masking field-by-field. A masked National ID (last-N) together with city + employer + income band + amount can re-identify an individual even when each field looks safe.

**Recommendation:** assess each lender's disclosure profile for *combined* re-identification risk, not per-field allow/deny.

## 7. Document key-custody two-sided failure — Medium (decision)

ADR-0007 leaves key custody open. The two failure directions must be resolved together: if the operator holds keys, that is a confidentiality surface over KYC PII; if keys are unrecoverable, lost keys mean unreadable records that then **fail** the 5-year retention obligation.

**Recommendation:** envelope encryption with controlled key escrow satisfies both; record who can decrypt in the ADR before R2 is bound.

## 8. Disbursement fabricates a lender — Low-Med (confirmed)

`confirmDisbursement` creates a "Default Partner Bank" lender inline when none exists (`makerCheckerDisbursement.ts:191-201`). On a path that moves money, silently inventing the contractual counterparty conflicts with ADR-0002, where the lender is the real contract party and payee.

**Recommendation:** require an explicit, configured lender on the application before disbursement; fail rather than fabricate.

## 9. Margin reversal is future work — Low / forward (decision)

ADR-0004 recognises margin **on collection**, but revenue accounts are not yet provisioned, so no margin is posted today. The current reversal rebuilds from stored principal/interest/fees allocations only (`financialLedger.ts:386-409`). When margin recognition is added, the reversal must also invert the recognised margin, and the stored allocation snapshot must grow to include it — otherwise a reversed payment will leave recognised revenue behind (the exact risk ADR-0004 flags).

**Recommendation:** when building margin, extend the payment's stored allocation to include margin components and add a property test: `Σ recognised − Σ reversed == margin on currently-collected cash`.

---

## Remediation tasks

Ordered step by step. **Phase 1** is code only and can start now (no owner
decision required). **Phase 2** needs an owner/counsel decision first, so each
task begins by superseding or extending an ADR, then implements it. **Phase 3**
is deferred until the feature it guards is built. Migrations are forward-only;
the next free number is **0008**, then 0009 in the order the migrations are
created.

### Phase 1 — code fixes (no ADR needed) — **DONE 2026-11-03** (88 tests pass)

- [x] **T1 — Make financial writes atomic (finding 1).**
  - [x] `processCashierPayment` now commits the journal entry, lines, `cashier_payments` row, loan-balance update and audit row through one `db.batch([...])`.
  - [x] `reverseCashierPayment` commits the compensating journal, `is_reversed` flip, `payment_reversals` row, balance restore and audit in one batch.
  - [x] `confirmDisbursement` commits the disbursement update, loan, schedule, installments, disbursement journal, application transition and audit in one batch.
  - [x] `entry_number` is allocated via `commitWithEntryNumber`, which retries on the `UNIQUE(agency_id, entry_number)` collision instead of leaving a partial write.
  - [ ] *Not done:* a true concurrency test. The test harness uses synchronous in-memory `node:sqlite`, which cannot model two simultaneous writers; a real test needs `wrangler dev`/Miniflare. Deferred.
- [x] **T2 — Enforce payment-reference uniqueness in the database (finding 5).**
  - [x] Added migration `0008_payment_reference_unique.sql`: `CREATE UNIQUE INDEX idx_cashier_payments_reference ON cashier_payments (agency_id, reference)`.
  - [x] Kept the pre-check for a friendly error; the batch `INSERT` failure is now the real guarantee and is mapped back to the existing `DUPLICATE_PAYMENT` 409.
  - [x] Corrected the ADR-0010 wording to "payment-reference uniqueness" and replaced the misleading "Idempotency guard" comment.
- [x] **T3 — Stop fabricating a lender on the disbursement path (finding 8).**
  - [x] Removed the inline "Default Partner Bank" creation.
  - [x] `confirmDisbursement` now resolves the application's `assigned_lender_id`, falls back to the agency's active lender, and throws `NO_ACTIVE_LENDER` (mapped to a 400) if none exists. Two tests that relied on the old fabrication now seed an active lender.

### Phase 2 — decisions first, then implementation (owner/counsel)

- [ ] **T4 — Gidfine holds client funds (finding 2).** *Direction decided 2026-11-03 → ADR-0016 (Provisional, Option B). Implement once Accepted.*
  - [x] Owner decision: **Gidfine holds client funds** (not the agent model).
  - [ ] Close ADR-0016's outstanding items (trust/escrow account + reconciliation, trust-liability account in the ledger per ADR-0004, written ADR-0014 licence-scope confirmation), then mark ADR-0002 Superseded.
  - [ ] Implement the trust-account control and the funds-held receipt/statement wording (ADR-0012).
- [ ] **T5 — Per-lender assignable disclosure rights (finding 3).** *Direction decided 2026-11-03 → ADR-0017 (Provisional). Implement once Accepted.*
  - [x] Owner decision: disclosure is **rights Gidfine assigns per lender**, **default-deny** (a lender with no rights sees nothing — keeps ADR-0006 fail-closed), **audited**.
  - [ ] Define the catalogue of grantable rights (the masked summary is one named right); counsel sign-off on lawful basis (ADR-0013); combined re-identification check (finding #6).
  - [ ] In `matchingEngine.ts`, exclude lenders with no rights for an application; stamp the rights in force on each issued proposal and generated document.
- [ ] **T6 — Value-tiered approval and reversal segregation (finding 4).** *Direction decided 2026-11-03 → ADR-0018 (Provisional). Implement once Accepted.*
  - [x] Owner decision: **value-tiered**; threshold **T** is a per-account setting; **single approver when T is unset**; reversal record-er ≠ approver.
  - [ ] Settings UI for **T** (surfacing the no-threshold ⇒ single-approver effect); define "supervisor" and role-enum names.
  - [ ] Add migration `0009` making `check_maker_checker_distinct` **conditional on amount** (enforced when amount ≥ T), not dropped; build the daily disbursement reconciliation report first (the named compensating control).
  - [x] **Reversal segregation shipped** (safe tightening, no gate): `reverseCashierPayment` rejects a reversal whose approver is the payment's recorder (`cashier_id === approver` → 403); test in `releaseCandidate.test.ts`.
  - [ ] Still gated on full acceptance: enforce the amount tier in `confirmDisbursement`, add migration `0009` for the conditional `check_maker_checker_distinct`, ship the daily reconciliation report, and replace the simulated MFA (`hardeningMfa.ts`) before go-live. Then mark ADR-0009 Superseded.
- [ ] **T7 — Combinatorial re-identification policy (finding 6).**
  - [ ] Extend ADR-0006's acceptance criteria to require each lender profile be assessed for *combined* re-identification risk, not field-by-field.
  - [ ] Review `createMaskedBorrowerSummary` output against that criterion.
- [ ] **T8 — Document key-custody model (finding 7).**
  - [ ] Close the open ADR-0007 item with an envelope-encryption + controlled-escrow design recording who can decrypt and whether the operator can read a file.
  - [ ] Only bind R2 and enable KYC upload once this is recorded.

### Phase 3 — deferred (build when the feature lands)

- [ ] **T9 — Margin reversal invariant (finding 9).**
  - [ ] When margin/revenue recognition (ADR-0004) is implemented, extend the payment's stored allocation snapshot to include margin components.
  - [ ] Make `reverseCashierPayment` invert recognised margin too.
  - [ ] Add a property test: `Σ recognised − Σ reversed == margin on currently-collected cash`.

---

## Process rule — how the delivery team closes these

This file is the authoritative remediation checklist. Any developer picking up
this work follows the rule below. It exists so a second team can proceed without
re-deciding what is settled or accidentally reverting a protected decision.

**R1 — Know which kind of task you have.** A task is either a **code fix** (no
owner decision needed) or **decision-gated** (needs a signed ADR first). Phase 1
is code. Phase 2 is decision-gated. Phase 3 is deferred until its feature exists.

**R2 — Code fixes: the definition of done.** A code task (T1, T2, T3, and the
implementation half of any Phase 2 task) is done only when **all** hold:
1. the change is implemented;
2. `cd workers/api && npm test` is green (currently 88 tests);
3. `npm run typecheck` introduces **no new** errors in the files you touched
   (the repo has a known pre-existing baseline — compare, don't aim for zero);
4. any new migration is the **next free number**, forward-only, and an **applied
   migration is never edited or renamed** (`BLOCKERS.md` §4);
5. the task's checkbox here is ticked with a dated note.

**R3 — Decision-gated tasks: decision before code.** For T4–T8 you may **not**
write behaviour until the matching proposed record in
[`ADR/DECISIONS.md`](./ADR/DECISIONS.md) is **Accepted and signed by the owner**.
The proposals already exist as drafts: **ADR-0016** (T4, funds custody),
**ADR-0017** (T5, disclosure-gated matching), **ADR-0018** (T6, approval tiers).
T7 and T8 attach to ADR-0006 and ADR-0007 respectively.

**R4 — Accepting a decision (the supersede procedure).** When the owner signs a
proposal:
1. fill in *Decision*, *Rationale*, *Decided by* and the date in the ADR;
2. set its status to **Accepted**;
3. mark the record it supersedes **Superseded** — never edit the old record;
4. update the index in `ADR/DECISIONS.md` and the status table in
   `IMPLEMENTATION_PLAN.md` §3.1;
5. only then implement the code half (under R2), and only then remove the
   matching simulation flags listed in the ADR's *Evidence in the codebase*.

**R5 — Never silently revert a protected decision.** The decisions in the
`AGENTS.md` "Protected decisions" table (impersonation read-only, maker/checker
constraint, simulation flags, lender fail-closed, `agency_id` filters,
server-side authorization) stay until a superseding ADR says otherwise. Disagree
in an ADR, not in a quiet code change.

**R6 — Go-live gate (applies before any real money or PII).** Independently of
the tasks, production of real disbursement, real PII, or signable contracts stays
closed until: real MFA replaces the simulated fixed codes; the daily disbursement
reconciliation report exists and passes on fixtures; and the counsel artefacts in
`BLOCKERS.md` (C-1…C-4) are recorded. See `EXECUTION_PLAN.md` for the release
checklist.

**Suggested order:** Phase 1 (done) → T4/ADR-0016 (unblocks the funds model that
T6 and receipts depend on) → T6/ADR-0018 with its reconciliation report and real
MFA → T5/ADR-0017 → T7, T8 → T9 when margin is built.

---

*Produced as a point-in-time review. Findings 1, 4, 5, 8 and the rounding note were confirmed against the cited files; findings 2, 3, 6, 7, 9 are decision-level and argued from the records. Fixing a code finding needs no ADR; changing a decision requires a superseding record under [`ADR/DECISIONS.md`](./ADR/DECISIONS.md).*
