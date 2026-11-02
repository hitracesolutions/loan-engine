# ADR-0006 — Lender KYC disclosures

- **Gate:** O-06
- **Status:** Provisional — direction recorded 2026-10-30, per-lender matrices outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Depends on:** ADR-0002, ADR-0013
- **Constrains:** lender proposal feed, notification payloads, generated documents

## Context

Lenders need enough information to price a proposal, but the disclosure boundary
is a legal question, not a product preference. The lender feed already returns a
masked summary — amount, tenure, employment, income band, city and a masked ID
number — constructed through `createMaskedBorrowerSummary`. Nothing establishes
that this is the lawful ceiling.

## Decision

**Per-lender disclosure agreements.** The attributes a lender may see are set by
that lender's agreement with Gidfine, not by a single global ceiling. Each
lender therefore carries its own disclosure profile, and the proposal feed
filters against it.

## Rationale

Recorded direction: lenders differ in what they need and what they are entitled
to, so the boundary must be contractual and configurable per lender rather than
baked into one code path.

## Consequences

- A lender **must not** be able to see a proposal before its disclosure profile
  exists. A missing profile must fail closed, never fall back to full detail.
- The masking helper becomes a policy *enforcer*: it takes the profile and
  removes fields, rather than hard-coding one mask shape.
- Notification payloads and generated documents (ADR-0012) must apply the same
  profile. A masked API response with an unmasked PDF or SMS is a breach.
- Auditors need to see which profile was in force when a proposal was issued.

## Outstanding before acceptance

- [ ] Signed disclosure matrix per lender (attribute list, legal basis).
- [ ] Default profile for a new lender, and the fail-closed behaviour confirmed.
- [ ] Field list reconciliation with `createMaskedBorrowerSummary` — does the
      current mask over- or under-disclose for any lender?

## Evidence in the codebase

- `workers/api/src/routes/lenders.ts` — masked proposal feed using
  `createMaskedBorrowerSummary`, including `id_number_masked`.
- `workers/api/migrations/0003_security_remediation.sql` — National ID stored
  AES-256-GCM encrypted with no plaintext column.
- `workers/api/src/domain/documentsAndOutbox.ts` — outbound payload construction
  where the same profile must apply.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-06
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 7
