# ADR-0007 — Document retention policy

- **Gate:** O-07
- **Status:** Provisional — retention and reader access decided 2026-10-30; key custody and deletion procedure outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Depends on:** ADR-0013, ADR-0014
- **Constrains:** R2 binding, document upload/download, deletion/anonymisation

## Context

`document_records` stores metadata and a SHA-256 integrity hash, but **no file
store is bound**: there is no R2 bucket in either wrangler configuration, so no
document has ever been uploaded or served. KYC documents are personal data, so
retention must be defined before any file is stored — not after.

## Decision

**Retention: 5 years after the loan closes.** Then the record and its documents
are deleted or anonymised under the procedure below.

**Access:** an uploaded KYC document may be opened by **agency staff** (per their
existing role permissions), **auditors**, and **the borrower themselves**. A
lender may never open a KYC document; lenders receive only the masked summary
defined in ADR-0006.

## Rationale

Recorded direction: the retention horizon is a regulatory question, not a
commercial preference, so it should follow whichever regime applies to the
licensed operating model.

## Consequences

- R2 cannot be bound until the period, the access list and the encryption story
  are agreed. Documents stay metadata-only, which means **KYC upload is not
  functional at launch** unless this record closes first.
- Deletion must be designed as retention-expiry with an audit trail, never as an
  ad-hoc delete, because financial record-keeping obligations may outlast the
  original purpose.
- Encrypted-at-rest storage needs key custody defined: who can read a document,
  and can the platform operator read it?

## Outstanding before acceptance

- [ ] Encryption/key custody model for stored objects (who can decrypt, and can
      the operator read the file).
- [ ] Deletion and anonymisation procedure executed at the 5-year mark, with
      audit trail.

## Evidence in the codebase

- `workers/api/src/domain/documentsAndOutbox.ts` — metadata plus SHA-256
  integrity hash; no object storage call.
- `workers/api/migrations/0007_sprint6_sprint7_docs_outbox_hardening.sql` —
  `document_records`.
- `frontend/wrangler.toml` and `workers/api/wrangler.jsonc` — no `r2_buckets`
  binding in either.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-07
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 8
