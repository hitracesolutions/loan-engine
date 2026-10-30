# ADR-0004 — Agency margin and revenue rules

- **Gate:** O-04
- **Status:** Provisional — direction recorded 2026-10-30, side/type selection per deal outstanding
- **Owner:** Matthias and the Gidfine executive team (with finance)
- **Version:** 0.1
- **Depends on:** ADR-0002, ADR-0003
- **Constrains:** ledger chart of accounts, ADR-0012

## Context

Gidfine must be paid, and the ledger must be able to say how much and from whom.
The chart of accounts built in Sprint 5 has no revenue semantics: no margin
account, no tax treatment, no statement of which party bears the margin.

## Decision

**Mixed margin model.** For any given deal Gidfine may:

- take a share of interest, **or**
- add a percentage (markup) applied on **either** the lender side or the
  borrower side,

charged either as a **flat amount** or as a **percentage**. Which of these
applies is a per-deal/per-product term that Gidfine sets during negotiation.

**Revenue recognition:** margin is recognised **when cash is collected** — not
at disbursement, and not accrued over the loan life.

## Rationale

Recorded direction: the commercial relationship differs between lenders and
borrowers, so the margin mechanism is negotiated rather than fixed by policy.
The system must express "who pays the margin and in what form" as data, not as
code.

## Consequences

- The quote record needs explicit `margin_type` (FLAT | PERCENTAGE),
  `margin_side` (LENDER | BORROWER), and `margin_value`, all included in the
  terms hash.
- The lender-facing quote and the borrower-facing quote can differ by design;
  each must be reproducible from stored terms, which makes the immutable
  snapshot in ADR-0003 load-bearing.
- Recognition on collection means margin posts only when a payment is allocated,
  so the waterfall in servicing becomes the revenue event. An unpaid or reversed
  instalment must not leave recognised revenue behind, which links this record to
  the reversal rules in ADR-0009.
- Classification depends on the side: a borrower-side markup is agency income,
  while a lender-side spread may be a cost-of-funds or commission treatment.
  That difference is still to be settled with the lender agreements.
- Tax and withholding treatment is still undecided and blocks invoicing/receipts
  (ADR-0012).

## Outstanding before acceptance

- [ ] Confirm allowed combinations (e.g. is margin-share plus flat fee allowed on
      the same deal?).
- [ ] VAT / withholding treatment per margin type.
- [ ] Revenue accounts provisioned in the chart of accounts.

## Evidence in the codebase

- `workers/api/src/domain/financialLedger.ts` — waterfall allocation
  (Fees → Interest → Principal) and compensating reversals, with no margin rule.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` — `accounts`,
  `journal_entries`, `journal_lines`; no revenue account provisioned.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-04
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 4
