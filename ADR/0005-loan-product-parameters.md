# ADR-0005 — Loan product parameters

- **Gate:** O-05
- **Status:** Provisional — direction recorded 2026-10-30, catalogue contents outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** ADR-0003, ADR-0004
- **Constrains:** lender product catalogue, repayment schedule generator

## Context

Lenders configure products, and the schedule generator has to honour whatever
those products allow. With no agreed parameter set, the catalogue can express
combinations the business has not sanctioned.

## Decision

1. **Payment frequencies:** flexible. Any frequency may be configured per
   product in the catalogue; there is no fixed monthly-only assumption.
2. **Grace periods and late penalties:** negotiated per product/deal, not set by
   global policy.
3. **Tenure:** **no cap.** Tenure is configured per product and the validation
   rule must not impose a global maximum.
4. **Early settlement:** **not allowed before maturity.** No rebate or penalty
   formula is implemented; the schedule runs to term.

## Rationale

Recorded direction: terms are commercial and differ by lender and product, so
the system must treat these as configuration rather than business rules
hard-coded in the engine.

## Consequences

- The schedule generator must be frequency-agnostic: weekly, biweekly, monthly and
  bespoke cadences all resolve from product configuration plus a start/value
  date, not from a monthly formula.
- Grace and penalty become nullable product attributes. A schedule with null
  grace/penalty must behave exactly as no grace and no penalty — never as an
  implicit default.
- Because anything is configurable, **validation becomes the control**: the
  catalogue needs bounds (maximum tenure, maximum penalty, minimum amount) or an
  operator can create an unpriceable product.
- Disclosure (ADR-0012) must render whatever the product says, including
  irregular cadences, without assuming monthly.

## Outstanding before acceptance

- [ ] Maximum late-penalty rate and minimum/maximum loan amount (tenure and early
      settlement are decided).
- [ ] Initial product catalogue shared by the lenders launching first.

## Evidence in the codebase

- `workers/api/migrations/0004_sprint3_lenders_matching_pricing.sql` —
  `lender_products`, `product_eligibility_criteria`.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` —
  `repayment_schedules`, `repayment_installments`.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-05
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) items 5 and 6
