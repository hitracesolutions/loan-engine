# ADR-0010 — Payment collection scope

- **Gate:** O-10
- **Status:** Provisional — MVP scope recorded 2026-10-30
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** ADR-0002
- **Constrains:** servicing routes, reconciliation jobs

## Context

The servicing layer accepts `CASH`, `SIMULATED_MOMO` and `SIMULATED_BANK`
payment methods. Nothing reaches a real payment provider, and no webhook or
reconciliation job exists.

## Decision

**Manual cashier entry only for MVP.** No Mobile Money, bank or card
integration at launch. Payments are recorded by an authorised cashier against a
loan, with compensating reversals for corrections. `SIMULATED_MOMO` and
`SIMULATED_BANK` are test-only values and must not be reachable in production
paths.

## Rationale

Recorded direction: launch without provider integration. It removes provider
contracting, webhook security and reconciliation design from the launch
critical path, at the cost of manual operational effort and a human
double-entry control on every payment.

## Consequences

- No payment webhook endpoint, no provider credentials, no automated
  reconciliation.
- Cashier authority becomes a security-critical role, which sharpens ADR-0009
  (who may record and reverse a payment).
- Manual entry makes duplicate-payment prevention depend on the existing
  idempotency key mechanism, so that path needs explicit testing.
- Future provider integration is additive: webhooks would post through the same
  journal entry path as manual entry.

## Outstanding before acceptance

- [ ] Written confirmation that manual-only scope is acceptable for launch.
- [ ] Cashier reconciliation procedure (who checks the daily total against the
      ledger, and how discrepancies are escalated).

## Evidence in the codebase

- `workers/api/src/domain/financialLedger.ts` — payment methods
  `'CASH' | 'SIMULATED_MOMO' | 'SIMULATED_BANK'`.
- `workers/api/src/routes/servicing.ts` — payment method input typing.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` —
  `cashier_payments`, `payment_reversals`.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-10
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 11
