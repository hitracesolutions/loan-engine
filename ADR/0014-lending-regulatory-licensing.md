# ADR-0014 — Lending and credit regulatory licensing

- **Gate:** O-14
- **Status:** Provisional — licence held per owner 2026-10-30, reference and per-model scope outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Depends on:** ADR-0002
- **Constrains:** commercial launch, live disbursement

## Context

This gate blocks the point where the platform stops being a simulation and
starts moving real money for real borrowers. It was raised because the operating
model — and therefore the required authorisation — was undefined.

## Decision

**Gidfine holds a licence for credit intermediation / moneylending.**

## Rationale

Recorded direction: the company is authorised to operate as a credit
intermediary and to lend, which satisfies the regulatory question for the
arranger and creditor models.

## Consequences

- Each operating model designated under ADR-0002 must sit **within** the scope of
  the licence held. Where a product line would need an authorisation Gidfine does
  not hold, that product must not be launched, regardless of code readiness.
- Licence conditions (capital, disclosure, interest ceilings, reporting) become
  product constraints. Any regulatory interest cap overrides ADR-0003 pricing for
  affected products.
- Periodic regulatory reporting becomes an operational obligation, which the
  reporting endpoints must eventually serve.

## Outstanding before acceptance

- [ ] Licence reference, class, issue date and expiry, recorded in the repo.
- [ ] Written confirmation that the licensed scope covers **each** operating
      model designated under ADR-0002, including the creditor-of-record model.
- [ ] Any interest, fee or disclosure ceilings imposed by the licence, and where
      they are enforced in code.
- [ ] Reporting obligations and their cadence.

## Evidence in the codebase

- `workers/api/src/domain/makerCheckerDisbursement.ts` — simulated disbursement
  adapter, the boundary that goes live when this record closes.
- `workers/api/migrations/0005_sprint4_consent_disbursement.sql` —
  `disbursement_records` with `simulation_mode`.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-14
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 14
