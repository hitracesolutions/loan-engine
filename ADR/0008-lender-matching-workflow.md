# ADR-0008 — Lender matching workflow

- **Gate:** O-08
- **Status:** Provisional — direction recorded 2026-10-30, routing rules outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Constrains:** proposal state machine, lender portal queues

## Context

An application has to reach lenders somehow. The matching engine currently
computes matches and **auto-generates proposal placeholders**, which is a
convenience for testing, not a routing policy.

## Decision

**Hybrid routing.** An application may run as a competitive 1-to-many round and
then fall back to sequential 1-to-1 routing. Which mode applies is a per-case
decision by the agency, not a global setting.

## Rationale

Recorded direction: competitive matching where speed and price discovery matter,
sequential where confidentiality or lender relationships matter. Both must be
available on the same application.

## Consequences

- The proposal state machine must model both modes, including the transition
  from a closed competitive round to a sequential fallback.
- Lender portal queues must distinguish "invited to bid" from "assigned to
  underwrite", or a lender will see the same application twice with different
  meaning.
- The placeholder auto-generation in the matching engine must not survive into
  live routing.

## Outstanding before acceptance

- [ ] Invitation blast radius: how many lenders may see one application in
      competitive mode.
- [ ] Round timeout before sequential fallback, and who triggers the fallback.
- [ ] Whether lenders may counter-offer, and who approves a counter.
- [ ] Audit requirement: record who saw the application and when.

## Evidence in the codebase

- `workers/api/src/domain/matchingEngine.ts` — eligibility matching and automatic
  proposal placeholder generation.
- `workers/api/migrations/0004_sprint3_lenders_matching_pricing.sql` —
  `matching_runs`, `lender_proposals`, `proposal_versions`.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-08
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 9
