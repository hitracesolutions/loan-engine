# ADR-0002 — Legal operating model

- **Gate:** O-02
- **Status:** Provisional — direction recorded 2026-10-30, per-product designation and legal signature outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** none
- **Constrains:** ADR-0003, ADR-0004, ADR-0009, ADR-0010

## Context

The platform can originate, price, approve and disburse, but nothing in the code
establishes *who Gidfine is* in the transaction. That identity decides the
contract counterparty, the source of disbursed funds, the legal payee for
repayments, and who carries allocation liability on partial or disputed
payments. Today all of it is simulated.

## Decision

Owner direction: **mixed model, designated per product.** Gidfine is not locked
into one role across the business — different products may run under different
operating models. The model is recorded per product in the catalogue
(ADR-0005), and each product must name:

1. the contractual counterparty (lender ↔ borrower, or Gidfine ↔ borrower),
2. the source of disbursed funds,
3. the legal payee for repayments,
4. who bears allocation liability on partial, early or disputed payment.

## Rationale

Recorded direction: a single model does not fit every product line, so the role
is a per-product attribute rather than a company-wide constant. This keeps the
engine flexible but makes the per-product designation mandatory — an
undesignated product must not be funded or contracted.

## Consequences

- `product_legal_model` becomes a required product attribute; disbursement and
  contract paths must reject a product without it.
- Ledger account semantics depend on the product model: a creditor model needs a
  receivable account, an arranger model recognises commission only, an agent
  model needs a trust/liability settlement account.
- Legal annex per product is still required. Until then, disbursement stays
  simulated.

## Outstanding before acceptance

- [ ] Designation of the operating model per product line.
- [ ] Signed legal operating model covering each designation.
- [ ] Contract templates naming the correct counterparty per model.

## Evidence in the codebase

- `workers/api/src/domain/makerCheckerDisbursement.ts` — channel typed
  `'SIMULATED' | 'BANK_TRANSFER' | 'MOBILE_MONEY'`, writes `simulation_mode = 1`.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` — chart of accounts
  with no payee or ownership semantics.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-02
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 2
