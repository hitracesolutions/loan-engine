# ADR-0001 — Tenancy model

- **Gate:** O-01
- **Status:** Accepted — owner direction recorded 2026-10-30
- **Owner:** Matthias and the Gidfine executive team
- **Decided by:** Owner (recorded 2026-10-30)
- **Version:** 1.0
- **Constrains:** every query that filters by `agency_id`

## Context

The schema is multi-tenant capable: every business table carries `agency_id`
and rows default to the single agency `gidfine`. Until now no commercial policy
existed for onboarding a second, independent agency onto the same deployment —
the only gate whose technical shape was already settled.

## Decision

**Single agency only.** Gidfine operates the platform for itself. No second
independent agency will be onboarded onto this deployment.

## Rationale

Recorded direction: Gidfine is the operator and the customer, so the complexity
of cross-agency provisioning, per-agency billing and cross-agency data isolation
buys nothing.

## Consequences

- No cross-agency isolation suite, agency provisioning flow or per-agency DPA is
  required for launch.
- `agency_id` stays in the schema and in queries. It is now a *defence-in-depth*
  filter and a future migration path, not a multi-tenant contract. Removing it
  would be a large, risky change for no launch benefit, so it stays.
- If a second agency is ever onboarded, this record must be **superseded** —
  not edited — because isolation guarantees would then need to be proven.

## Evidence in the codebase

- `agency_id` on all tables from `workers/api/migrations/0001_core.sql` onward,
  including the compound idempotency key `(agency_id, key)`.
- Staff and lender access scoping already filters by `agency_id`.

## Follow-up

- [ ] Note in `IMPLEMENTATION_PLAN.md` that SaaS onboarding requires a new ADR.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-01
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 1
