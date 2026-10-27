# GIDFINE — PHASE 3C: END-TO-END SECURITY AUDIT

**Repository:** `hitracesolutions/loan-engine`
**Specification:** `Gidfine_Dev_Guide.md` v1.2 (Sections 7 and 12)
**Architecture stack:** React 19 + Vite (Cloudflare Pages) → Cloudflare Workers → D1 / R2 / Durable Objects
**Date:** 27 October 2026
**Status:** 📐 Audit plan and control requirements — full audit runs after the Worker cutover

> This record replaces the Convex-era Phase 3C report of the same name. The PDF of the same name in this directory is superseded evidence.

---

## 1. Scope

| Surface | Included |
| --- | --- |
| Worker routes (auth, applications, proposals, lender, approvals, ledger) | ✅ |
| D1 schema, tenancy indexes and constraints | ✅ |
| R2 document access and signed URLs | ✅ |
| Durable Object session isolation | ✅ |
| React client (trust boundaries, token handling, PII exposure) | ✅ |
| Cloudflare configuration (secrets, CORS, rate limits, logging) | ✅ |
| Third-party integrations (lenders, model providers, email/SMS) | ✅ |

Out of scope: lender-side systems, mobile clients, physical security.

---

## 2. Threat model

| # | Threat | Asset | Control |
| --- | --- | --- | --- |
| T1 | IDOR on application ids | Loan data | ULID ids + tenant-scoped queries; `404` on cross-tenant |
| T2 | Tenant escape via body/query params | All records | `agency_id` taken from the JWT only |
| T3 | Cross-role leakage | PII, margins | Field-level redaction before serialisation |
| T4 | State-machine bypass | Financial terms | Central transition guard + DB status precondition |
| T5 | Duplicate financial posting | Ledger | `Idempotency-Key` + unique index |
| T6 | Token replay / theft | Accounts | Short-lived JWT, refresh rotation, `HttpOnly` cookies where applicable |
| T7 | Credential stuffing | Accounts | PBKDF2 + rate limiting + lockout/backoff |
| T8 | Malicious upload | R2, OCR pipeline | Content-type allow-list, size cap, malware scan job, no direct public read |
| T9 | Prompt injection via documents/chat | Agent behaviour | Agents never hold authority; deterministic guards after extraction |
| T10 | PII in logs | Audit/compliance | Structured logging with a redaction allow-list |
| T11 | Enumeration / bulk export | All records | Pagination caps, export rate limits, audit every export |
| T12 | Superseded proposal reuse | Terms integrity | Version check (`version`, `superseded_at`) on every decision |

---

## 3. Control matrix

| Control | Requirement | Status |
| --- | --- | --- |
| Authentication | Worker-issued JWT; `jose` verification on every protected route | ⬜ |
| Password storage | PBKDF2-HMAC-SHA-256, ≥ 210,000 iterations, per-user salt | ⬜ |
| Session tokens | Access ≤ 15 min, refresh rotation, revocation table | ⬜ |
| Authorisation | Role + ownership + tenant check per route | ⬜ |
| Field disclosure | Explicit column allow-list per audience | ⬜ |
| Transport | TLS only; HSTS; no mixed content | ⬜ |
| CORS | Exact allow-list (`ALLOWED_ORIGINS`), no `*` with credentials | ⬜ |
| Rate limiting | Auth, OTP, upload, export routes | ⬜ |
| Input validation | Schema validation on body, query and path params | ⬜ |
| SQL safety | Parameterised D1 statements only; no string interpolation | ⬜ |
| Idempotency | Required on financial POSTs | ⬜ |
| Audit trail | Append-only `audit_events` for 5 milestones + postings | ⬜ |
| Document access | R2 private; signed URLs ≤ 5 min, tenant-scoped keys | ⬜ |
| Secret management | `wrangler secret`, per-environment; never in git or `VITE_*` | ⬜ |
| Logging | No tokens, document contents, full PII, or raw request bodies | ⬜ |
| Dependency hygiene | `npm audit` in CI; pinned lockfile | 🟡 |

---

## 4. Findings in the current tree

These were observed during the documentation rebase and must be closed before cutover.

| # | Severity | File | Finding | Required fix |
| --- | --- | --- | --- | --- |
| F1 | 🟠 High | `frontend/src/App.tsx` | OAuth callback handling trusts `name`, `email`, `picture`, `phone` from the query string and, when `session_id` is absent, populates the user store without any server verification. This allows client-side identity spoofing (the server remains authoritative, but the UI can display a forged identity). | Remove the unverified branch; accept only a server-verified session, then fetch the profile from the API. |
| F2 | 🟠 High | `frontend/src/lib/config.ts`, `frontend/src/api/client.ts` | Production API host is hard-coded (`nbfc-inc.onrender.com`). A build with a missing env var silently targets a retired host rather than failing. | Require `VITE_API_BASE`; fail the build when it is absent in production. |
| F3 | 🟡 Medium | `frontend/src/api/client.ts` | `console.log` of base URL and environment on every import — configuration disclosure and noisy production logs. | Remove debug logging; add a single gated dev-only logger. |
| F4 | 🟡 Medium | `frontend/src/lib/convex.tsx` | The Convex provider degrades silently to "no backend" when `VITE_CONVEX_URL` is unset, masking misconfiguration. | Delete at cutover; replace with an explicit API-unavailable state. |
| F5 | 🟡 Medium | `frontend/src/lib/api.ts`, `src/api/client.ts`, `src/api/websocket.ts` | Three overlapping clients with different base-URL, error and retry behaviour. | Consolidate into `src/services/http.ts`. |
| F6 | 🟡 Medium | `frontend/public/` | No `_redirects`; deep links such as `/docs` will 404 on Cloudflare Pages. | Add `/* /index.html 200`. |
| F7 | ⚪ Low | `frontend/tests/*.test.ts` | Tests import `../convex/**`; they block removal of the Convex backend. | Repoint to `workers/api/src/domain/**`. |
| F8 | ⚪ Low | `frontend/vercel.json` | Stale deployment target. | Delete when Pages takes over. |

> Severity scale: 🔴 critical (exploitable, financial or PII impact) · 🟠 high (exploitable with preconditions) · 🟡 medium (defence-in-depth or misconfiguration) · ⚪ low (hygiene).

---

## 5. Audit procedure

### 5.1 Authentication and authorisation

- [ ] Call every protected route with no token → `401`.
- [ ] Call every route with an expired token → `401` and one refresh attempt from the client.
- [ ] Call every route with a valid token for the wrong role → `403`.
- [ ] Call every route with a valid token for another tenant → `404` (never `403` with existence leakage).
- [ ] Verify refresh rotation invalidates the previous refresh token.

### 5.2 Data disclosure

- [ ] Diff the lender payload against the redaction matrix in [Phase 3B](GIDFINE_PHASE3B_LENDER_PORTAL_REPORT.md#3-redaction-matrix).
- [ ] Diff the borrower payload before and after `AGENCY_APPROVED`.
- [ ] Confirm errors never echo submitted values.
- [ ] Confirm `audit_events` stores actor ids, not full records.

### 5.3 Financial integrity

- [ ] Same `Idempotency-Key` twice → one journal transaction, identical response.
- [ ] Reversal pairs balance to zero.
- [ ] Sum of installments equals the approved total under the rounding policy.
- [ ] Concurrent disbursement approvals with the same key → exactly one posting.

### 5.4 Documents

- [ ] Unsigned R2 object URL returns `403`.
- [ ] Signed URL expires.
- [ ] Tenant A cannot sign a URL for tenant B's object key.
- [ ] Upload of a disallowed content type is rejected.

### 5.5 Configuration

- [ ] `wrangler.jsonc` contains no secrets.
- [ ] `.dev.vars` is git-ignored.
- [ ] CORS rejects an unlisted origin.
- [ ] Rate limit returns `429` after the configured threshold.

---

## 6. Exit criteria

The audit passes only when:

1. No 🔴 or 🟠 finding remains open.
2. Every control in section 3 is implemented or has a signed, time-boxed exception.
3. The automated suites cover tenancy, role, redaction, idempotency and state-machine bypass.
4. The evidence (commands, outputs, screenshots) is attached to the release record.
