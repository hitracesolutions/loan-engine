# GIDFINE — PHASE 3C: END-TO-END SECURITY AUDIT

**Repository:** `hitracesolutions/loan-engine`
**Specification:** `Gidfine_Dev_Guide.md` v1.2 (Sections 7 and 12)
**Architecture stack:** React 19 + Vite (Cloudflare Pages) → Cloudflare Workers → D1 / R2 / Durable Objects
**Date:** 27 October 2026
**Status:** 🟡 High findings closed; full audit runs after the remaining Worker routes land

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

| Control | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| Authentication | Worker-issued JWT; `jose` verification on every protected route | ✅ | `lib/auth.ts#requireActor`, used by `/auth/me` and `/applications` |
| Password storage | PBKDF2-HMAC-SHA-256, ≥ 210,000 iterations, per-user salt | ✅ | `lib/auth.ts#hashPassword`, 5 tests |
| Session tokens | Access ≤ 15 min, refresh rotation, revocation table | 🟡 | 15-min access tokens live; refresh/revocation outstanding (F11) |
| Authorisation | Role + ownership + tenant check per route | ✅ | Route guards + `validateStateTransition` |
| Field disclosure | Explicit column allow-list per audience | 🟡 | `loan_applications` selects explicit columns; lender matrix pending |
| Transport | TLS only; HSTS; no mixed content | ⬜ | Cloudflare default; HSTS header to be set at cutover |
| CORS | Exact allow-list (`ALLOWED_ORIGINS`), no `*` with credentials | ✅ | `lib/http.ts#corsHeaders`, verified against an unlisted origin |
| Rate limiting | Auth, OTP, upload, export routes | ⬜ | F10 |
| Input validation | Schema validation on body, query and path params | ✅ | `lib/validation.ts`, `lib/money.ts` |
| SQL safety | Parameterised D1 statements only; no string interpolation | ✅ | Every statement uses `.bind()` |
| Idempotency | Required on financial POSTs | ✅ | `lib/idempotency.ts`; replay verified on `POST /applications` |
| Audit trail | Append-only `audit_events` for 5 milestones + postings | 🟡 | Registration and submission recorded; milestones land with those routes |
| Document access | R2 private; signed URLs ≤ 5 min, tenant-scoped keys | ⬜ | R2 binding not yet added |
| Secret management | `wrangler secret`, per-environment; never in git or `VITE_*` | ✅ | `JWT_SIGNING_KEY` via `wrangler secret` / `.dev.vars` (git-ignored) |
| Logging | No tokens, document contents, full PII, or raw request bodies | ✅ | Structured 5xx logging with request id only |
| Dependency hygiene | `npm audit` in CI; pinned lockfile | ✅ | Both lockfiles committed; 0 vulnerabilities |

---

## 4. Findings

### 4.1 Closed

| # | Severity | File | Finding | Fix applied |
| --- | --- | --- | --- | --- |
| F1 | 🟠 High | `frontend/src/App.tsx` | OAuth callback handling trusted `name`, `email`, `picture`, `phone` from the query string and, when `session_id` was absent, populated the user store with no server verification — client-side identity spoofing. | Unverified branch removed. Only a server-resolved `session_id` can populate the session, and `cust.name` is now required before `setUser` is called. |
| F2 | 🟠 High | `frontend/src/lib/config.ts`, `frontend/src/api/client.ts` | Production API host was hard-coded (`nbfc-inc.onrender.com`); a build missing the env var silently targeted a retired host. | Single resolution point in `src/lib/config.ts`: `VITE_API_BASE` → dev `http://localhost:8787` → production same-origin **with a warning**. No hard-coded host remains anywhere in `src/`. |
| F3 | 🟡 Medium | `frontend/src/api/client.ts` | `console.log` of base URL and environment on every import — configuration disclosure and noisy logs. | Debug logging removed; the client now imports the resolved `API_BASE`. |
| F6 | 🟡 Medium | `frontend/public/` | No `_redirects`, so deep links such as `/docs` would 404 on Cloudflare Pages. | `frontend/public/_redirects` added with `/* /index.html 200`. |
| F8 | ⚪ Low | `frontend/vercel.json` | Stale deployment target. | Deleted. |
| F9 | 🟡 Medium | `frontend/package-lock.json` | `convex` was declared in `package.json` but absent from the lockfile, so `npm ci`, `tsc -b` and four test files failed. | Lockfile regenerated; `npm ci`, `npm run build` and all 52 frontend tests pass. |

### 4.2 Open

| # | Severity | File | Finding | Required fix |
| --- | --- | --- | --- | --- |
| F4 | 🟡 Medium | `frontend/src/lib/convex.tsx` | The Convex provider degrades silently to "no backend" when `VITE_CONVEX_URL` is unset, masking misconfiguration. | Delete at cutover; replace with an explicit API-unavailable state. |
| F5 | 🟡 Medium | `frontend/src/lib/api.ts`, `src/api/client.ts`, `src/api/websocket.ts` | Three overlapping clients with different error and retry behaviour. They now share one base URL but remain duplicated. | Consolidate into `src/services/http.ts` once the Worker routes cover those calls. |
| F7 | ⚪ Low | `frontend/tests/*.test.ts` | Tests import `../convex/**`, which blocks removal of the Convex backend. | Repoint to `workers/api/src/domain/**` (the ported state machine is already covered by `workers/api/tests/stateMachine.test.ts`). |
| F10 | 🟡 Medium | `workers/api/src/index.ts` | No rate limiting on `/auth/*` yet. | Add the Cloudflare rate-limiting binding before production cutover. |
| F11 | 🟡 Medium | `workers/api` | Access tokens have no refresh/rotation or revocation path. | Add `POST /auth/refresh` and a revocation table (migration `0002`). |

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
