# ADR-0002 — Legal operating model

- **Gate:** O-02
- **Status:** Provisional — arranger model decided 2026-10-30; signed legal annex outstanding
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

**Arranger for every product at launch.** Gidfine is an intermediary: contracts
run lender ↔ borrower, Gidfine does not hold funds, and the legal payee for
repayments is the lender.

This **supersedes** the earlier "mixed model, designated per product" direction
(2026-10-30, unversioned draft). The mixed model is deliberately deferred, not
rejected: reintroducing it requires a new ADR that supersedes this one.

## Rationale

Recorded direction (2026-10-30, blocker B-2): one operating model for launch
removes per-product legal annexes, keeps the ledger to commission revenue, and
avoids holding customer funds — which would add trust-account and licensing
obligations that are not needed to start.

## Consequences

- No `product_legal_model` attribute is required at launch. Adding one later is a
  forward migration, not a breaking change.
- The chart of accounts needs commission revenue only; no receivable or trust
  liability account is required yet.
- If a creditor-of-record product is ever launched, this record is superseded and
  the ledger, contracts and licensing scope all change together.

## Outstanding before acceptance

- [ ] Signed legal operating-model document confirming the arranger model,
      naming the lender as payee for repayments.
- [ ] Contract templates naming the lender as counterparty.

## Evidence in the codebase

- `workers/api/src/domain/makerCheckerDisbursement.ts` — channel typed
  `'SIMULATED' | 'BANK_TRANSFER' | 'MOBILE_MONEY'`, writes `simulation_mode = 1`.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` — chart of accounts
  with no payee or ownership semantics.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-02
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 2
