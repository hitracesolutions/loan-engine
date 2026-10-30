# ADR-0015 — Administrator impersonation ("view as")

- **Gate:** none — operational security decision, not an owner gate
- **Status:** Accepted — implemented 2026-10-30
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 1.0
- **Constrains:** every route, through the request guard

## Context

Support and operations need to see the platform as a specific user to diagnose a
problem. On a lending platform that ability is also the shortest path to
fraud: a session that can act as a borrower could accept an offer, sign a
consent, or move money, and a session that can act as a cashier could record a
payment.

The feature was requested for administrator use. This record fixes the
boundaries it is built to, so the next change to it is a decision rather than a
convenience.

## Decision

Administrators (`agency_admin`) may start a short-lived, **read-only** session as
another non-administrator account in the same agency.

1. **Read-only.** The request guard rejects every `POST`/`PUT`/`PATCH`/`DELETE`
   from an impersonated token except `POST /admin/impersonate/stop`. A borrow
   consent, an offer acceptance, a disbursement, a payment or a reversal can
   therefore never be performed while impersonating.
2. **No privilege escalation.** Only `agency_admin` may start a session, an
   impersonated session cannot start another, self-impersonation is rejected,
   and administrators cannot impersonate other administrators.
3. **Same agency, active accounts only.**
4. **Short lived.** 15 minutes, independent of the normal access-token TTL.
5. **Revocable.** Stopping a session writes an audit event, and the guard rejects
   the still-valid token afterwards.
6. **Audited.** `IMPERSONATION_STARTED` and `IMPERSONATION_STOPPED` are written to
   `security_audit_logs` with the administrator, the target, the session id, IP
   and user agent.

## Rationale

Read-only is the only default that is defensible for a financial system. It keeps
the diagnostic value of "seeing what the user sees" while removing the ability to
create legally binding evidence (consent), change money, or approve anything.

## Consequences

- Support cannot fix data by acting as the user; they must use a dedicated
  administrative endpoint that the user's own role could not call. This is
  intentional friction.
- Consent records can never be produced by impersonation, which keeps consent
  evidence defensible under ADR-0013.
- Any future "write while impersonating" request must supersede this record with a
  named compensating control, not extend the allowlist silently.

## Evidence in the codebase

- `workers/api/src/lib/impersonationGuard.ts` — guard that runs before the router,
  so a new route cannot forget the rule.
- `workers/api/src/domain/impersonation.ts` — target validation, audit events,
  revocation lookup.
- `workers/api/src/routes/impersonation.ts` — the three endpoints.
- `workers/api/tests/impersonation.test.ts` — nine tests covering the token
  claims, read-only enforcement, privilege rules and revocation.
- `frontend/src/components/ImpersonationPanel.tsx` and
  `ImpersonationBanner.tsx` — admin control and the persistent read-only banner.

## References

- [`IMPLEMENTATION_PLAN.md` §9](../IMPLEMENTATION_PLAN.md) — quality gates
- [`EXECUTION_PLAN.md`](./../EXECUTION_PLAN.md) — step S-10
