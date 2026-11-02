# ADR-0013 — Data protection compliance (Act 843)

- **Gate:** O-13
- **Status:** Provisional — DPC registration confirmed 2026-10-30, written sign-off on consent and privacy text outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Constrains:** any processing of live borrower PII, notification consent, document retention

## Context

The platform captures borrower identity, income, employer and National ID, and
encrypts the ID at rest with AES-256-GCM. Consent is recorded with an immutable
SHA-256 hash of the agreed terms. What is missing is the legal instrument: the
registration status and the approved privacy wording that makes that capture
lawful under the Ghana Data Protection Act, 2012 (Act 843).

## Decision

**Registered with the Data Protection Commission — certificate held.**

Registration is necessary but not sufficient: consent wording, the privacy
notice shown to borrowers, and the record of processing activities must also be
signed off before live PII is processed at commercial scale.

## Rationale

Recorded direction: Gidfine is a registered data controller, which resolves the
licensing question the gate was originally raised for.

## Consequences

- Live borrower PII processing is no longer blocked on registration. It remains
  blocked on the approved privacy notice and consent text.
- The consent record must be able to evidence *which* privacy wording a borrower
  accepted, which means the notice version belongs in the terms hash.
- Data-subject rights (access, correction, deletion) need an operational route.
  Deletion must reconcile with financial retention (ADR-0007), so the answer is
  usually anonymisation rather than erasure.
- SMS and email consent (ADR-0011) falls under the same instrument and needs the
  same evidencing.

## Outstanding before acceptance

- [ ] Certificate reference and expiry recorded, with a renewal owner.
- [ ] Approved privacy notice text and version.
- [ ] Consent wording signed off, and the notice version added to the terms hash.
- [ ] Record of processing activities (what data, why, who can see it, how long).
- [ ] Data-subject request procedure and the anonymisation path for closed loans.

## Evidence in the codebase

- `workers/api/migrations/0003_security_remediation.sql` — AES-256-GCM encrypted
  National ID columns with ciphertext, IV, tag and version; no plaintext.
- `workers/api/src/domain/consentWorkflow.ts` — immutable SHA-256 consent terms
  hash (`CONSENT_ALGORITHM_VERSION`, `sha256-v1`).
- `workers/api/src/routes/lenders.ts` — masked disclosure path that must keep
  matching the approved notice.

## References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-13
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 14
