# ADR-0003 — Interest calculation method

- **Gate:** O-03
- **Status:** Provisional — direction recorded 2026-10-30, per-product assignment outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** ADR-0002
- **Constrains:** ADR-0004, ADR-0012

## Context

The pricing engine computes quotes under two explicitly labelled simulation
strategies and tags every result `is_simulation = 1`, `status = 'PROVISIONAL'`.
The default nominal rate is hard-coded at 24% p.a. No basis or method has been
agreed with a lender or borrower.

## Decision

1. **Rate basis:** both monthly and annual rates are quoted **side by side** on
   every quote and disclosure, so the borrower sees the same price in either
   unit.
2. **Method:** not fixed globally. Gidfine selects the calculation method during
   negotiation, per deal/product. The engine must therefore support **flat** and
   **reducing balance** side by side, with the chosen method recorded on the
   quote, the offer and the consent evidence.
3. **Rounding:** **round half up to the nearest pesewa.** Applies to both methods
   and to every figure shown to a borrower or lender.

## Rationale

Recorded direction: Gidfine decides the method during negotiation, so the method
is a negotiated term rather than a system-wide setting. Quoting both bases keeps
disclosure comparable and prevents a monthly figure from hiding a higher annual
cost.

## Consequences

- The engine keeps both strategies but they must be *selected*, not merely
  defaulted: quote records need an explicit `calculation_basis` (MONTHLY |
  ANNUAL) and `calculation_method` (FLAT | REDUCING_BALANCE).
- The consent terms hash must include both fields so a borrower's agreed terms
  cannot silently change method later.
- Worked examples are required per (basis × method) combination before live use.

## Outstanding before acceptance

- [ ] Default or allowed set of methods per product (feeds ADR-0005).
- [ ] Worked calculator fixtures for flat and reducing balance at monthly and
      annual basis, using round-half-up.

## Evidence in the codebase

- `workers/api/src/domain/pricingEngine.ts` — `FLAT_SIMULATION`,
  `REDUCING_BALANCE_SIMULATION`; results flagged `isSimulation: true`; canonical
  SHA-256 snapshot hash.
- `workers/api/src/routes/lenders.ts` — defaults to `FLAT_SIMULATION` and
  `rateBps = 2400`.
- `workers/api/src/domain/consentWorkflow.ts` — `rateBps = 2400` default.
- `workers/api/migrations/0004_sprint3_lenders_matching_pricing.sql` — basis
  point check constraint `0 <= bps <= 10000`.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-03
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 3
