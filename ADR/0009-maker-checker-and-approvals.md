# ADR-0009 — Maker-checker and approvals

- **Gate:** O-09
- **Status:** Provisional — direction recorded 2026-10-30, and it **conflicts with shipped schema**
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** ADR-0002
- **Constrains:** disbursement endpoints, payment reversal, MFA

## Context

Sprint 4 shipped strict Maker-Checker dual control: the database enforces
`checker_id != maker_id` and the API returns 403 when one user attempts both
roles. Sprint 5 shipped payment reversals as append-only compensating entries.
Nothing yet states who is *allowed* to hold these roles, or how many people a
single action requires.

## Decision

1. **Disbursement:** a **single authorised approver is sufficient.** Dual
   authorisation is not required. The approver is either `agency_admin` or
   `loan_officer` — no new role is introduced.
2. **Payment reversal:** a cashier may not reverse alone. A cashier-initiated
   reversal requires **supervisor approval**, while an **admin** may reverse
   directly.
3. **Compensating control:** with dual control removed, a **daily supervisor
   reconciliation report over disbursements** is mandatory. It is the only
   detective control left on that money movement, so it is part of this decision,
   not an optional extra.

## Rationale

Recorded direction: disbursement volume and staffing make dual control
impractical on every loan, so authority is concentrated in a named approver
role. Reversals keep a second pair of eyes because they are the classic
misappropriation path: a payment recorded then reversed moves money without a
matching cash receipt.

## Consequence that must not be missed

**This decision contradicts the schema already deployed.** `0005` carries:

```sql
CONSTRAINT check_maker_checker_distinct CHECK (checker_id IS NULL OR checker_id != maker_id)
```

and the API returns 403 when maker and checker are the same user. Single-approver
disbursement therefore **cannot work until a forward migration relaxes or drops
that constraint**. Until that migration exists, dual control remains the
enforced behaviour and the owner decision is not in force. That is deliberate:
the record leads, the migration follows, and no constraint is dropped silently.

Removing dual control also removes the compensating control against fat-finger
and fraud alike, so the replacement control must be named before the constraint
is dropped — for example a mandatory second-person reconciliation report, or a
per-day disbursement ceiling per approver.

## Outstanding before acceptance

- [ ] Named approver role(s) and the permission matrix (who may override a rate,
      who may record a payment).
- [ ] Build the daily disbursement reconciliation report before the constraint is
      relaxed — it is the named compensating control.
- [ ] Exact role names mapped to the code's role enum.
- [ ] Forward migration to relax the maker/checker constraint.
- [ ] **Replace the simulated MFA** — `hardeningMfa.ts` currently accepts the
      fixed codes `123456` and `654321` for privileged users. That must never
      reach production, and the disbursement decision above assumes real MFA.

## Evidence in the codebase

- `workers/api/migrations/0005_sprint4_consent_disbursement.sql` — maker/checker
  columns and the distinctness constraint.
- `workers/api/src/domain/makerCheckerDisbursement.ts` — dual-control
  enforcement and simulated disbursement adapter.
- `workers/api/src/domain/hardeningMfa.ts` — simulated TOTP acceptance.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` — `cashier_payments`,
  `payment_reversals`.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-09
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 10
