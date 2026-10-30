# ADR-0012 — Generated financial documents

- **Gate:** O-12
- **Status:** Provisional — scope recorded 2026-10-30, templates outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Depends on:** ADR-0003, ADR-0004, ADR-0007, ADR-0013
- **Constrains:** PDF generation, R2 usage, notification attachments

## Context

No document is generated anywhere in the platform today: there is no PDF path,
no template engine, and no object store bound. Records are structured data only.

## Decision

**Full document set at launch**, comprising at minimum:

1. loan offer / terms disclosure,
2. credit agreement,
3. repayment schedule,
4. payment receipts,
5. account statements.

## Rationale

Recorded direction: a lending product without a signed agreement and a schedule
the borrower can hold is not defensible in a dispute, and Act 843 obligations
(ADR-0013) are easier to evidence with issued documents than with database rows.

## Consequences

- A renderer is required. It must read **stored** terms (the immutable quote and
  consent snapshots) rather than recomputing, so a reissued document matches what
  the borrower agreed to.
- Documents must honour the lender disclosure profile (ADR-0006): the same field
  filtering applies to generated artefacts, not just API responses.
- Storage depends on ADR-0007. Until R2 is bound, documents can be generated and
  streamed but not retained, which most likely fails the retention requirement.
- Receipts and statements are derivative artefacts of ledger entries, so they
  must be regenerable from the ledger rather than stored as the source of truth.

## Outstanding before acceptance

- [ ] Approved templates for each document type.
- [ ] Whether an electronic signature is required, and of what kind.
- [ ] Numbering scheme for agreements and receipts (auditable, gap-free).
- [ ] Which documents must also be emailed or SMS-notified (ADR-0011), and
      whether attachments are permitted.
- [ ] Storage decision once ADR-0007 sets the retention rule.

## Evidence in the codebase

- `workers/api/migrations/0007_sprint6_sprint7_docs_outbox_hardening.sql` —
  `document_records` metadata with SHA-256 integrity hash.
- `workers/api/src/domain/pricingEngine.ts` — immutable quote snapshot the
  schedule document must render from.
- `workers/api/src/domain/consentWorkflow.ts` — consent terms hash that a
  generated agreement must match.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-12
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 13
