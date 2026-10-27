# GIDFINE — PHASE 3A: REACT ↔ CLOUDFLARE API INTEGRATION

**Repository:** `hitracesolutions/loan-engine`
**Specification:** `Gidfine_Dev_Guide.md` v1.2
**Architecture stack:** React 19 + Vite (Cloudflare Pages) → Cloudflare Workers → D1
**Date:** 27 October 2026
**Status:** 🟡 UI implemented; API integration pending the Worker cutover

> This record replaces the Convex-era Phase 3A report of the same name. The PDF of the same name in this directory is superseded evidence.

---

## 1. Objective

Connect the React single-page application to the Cloudflare Worker API through a **single typed service boundary**, so that:

- no component talks to a database, a third-party SDK or a hard-coded host,
- every server call is authenticated and tenant-scoped,
- the borrower and agency flows are driven by server state, not client assumption.

---

## 2. What already exists

| Component | Path | State |
| --- | --- | --- |
| App shell and routing | `frontend/src/App.tsx` | ✅ React 19, `/docs` public route |
| Workspace layout | `frontend/src/components/workspace/layout/DashboardLayout.tsx` | ✅ |
| Borrower application UI | `frontend/src/components/workspace/pages/LoanApplication.tsx` | ✅ |
| Borrower loan manager | `frontend/src/components/workspace/BorrowerLoanManager.tsx` | ✅ |
| Agency review queue | `frontend/src/components/AgencyReviewQueue.tsx` | ✅ |
| Admin dashboard | `frontend/src/components/AdminDashboard.tsx` | ✅ |
| Client store | `frontend/src/store/useLoanStore.ts` (Zustand) | ✅ |
| Unit tests | `frontend/tests/*.test.ts` | ✅ `node:test` |

---

## 3. Target integration design

### 3.1 Typed service boundary

All server access is centralised in `frontend/src/services/`:

```text
frontend/src/services/
├── http.ts            # fetch wrapper: base URL, auth header, error envelope, timeout, retry
├── loans.ts           # applications, proposals, approvals, consent
├── lender.ts          # lender proposal queue and decisions
├── ledger.ts          # disbursements, repayments, journal reads
└── types.ts           # request/response contracts shared with the Worker
```

Rules:

- `http.ts` is the **only** module that calls `fetch` for business data.
- Base URL comes from `VITE_API_BASE`; there is no production fallback host.
- A `401` triggers one refresh attempt, then clears the session and returns the user to landing.
- A `403` is surfaced as a permission state, never retried.
- Responses are validated against `types.ts` at the boundary before reaching components.

### 3.2 Request contract

```http
POST /applications
Authorization: Bearer <jwt>
Content-Type: application/json
Idempotency-Key: <uuid-v4>

{
  "requestedAmountPesewas": 5000000,
  "tenureMonths": 36,
  "purpose": "business",
  "consentSnapshot": { "version": "2026-10", "affirmed": true }
}
```

```json
{
  "ok": true,
  "data": {
    "applicationId": "01JB8Z6Q8K7Q2V9Q3Z6D9W1C4M",
    "status": "SUBMITTED",
    "createdAt": 1793145600000
  },
  "requestId": "req_01JB8Z6R..."
}
```

Errors use one envelope:

```json
{ "ok": false, "error": { "code": "INVALID_STATE", "message": "…" }, "requestId": "req_…" }
```

### 3.3 Borrower flow

1. Submit an application (amount, tenure, purpose) with an idempotency key.
2. Track status from the server: `SUBMITTED → UNDER_REVIEW → LENDER_PENDING → LENDER_ACCEPTED → AGENCY_APPROVED → BORROWER_ACCEPTED`.
3. Unapproved proposals are **not** included in the borrower payload at all — the UI must not need to hide them.
4. Consent is an affirmative action; the Worker persists a SHA-256 hash of the terms snapshot.

### 3.4 Agency flow

1. Review queue filtered by status, paginated, tenant-scoped.
2. Propose terms to an assigned lender; each proposal increments `version` and supersedes the previous one.
3. Approve only when the assigned lender has accepted and the borrower's consent matches the approved version.

### 3.5 Environment configuration

| Variable | Staging | Production |
| --- | --- | --- |
| `VITE_API_BASE` | `https://api-staging.gidfine.com` | `https://api.gidfine.com` |

Both are public build-time values. No secret may use the `VITE_` prefix.

---

## 4. Invariants

| # | Invariant | Enforced where |
| --- | --- | --- |
| I1 | Identity is derived from the JWT, never from the request body | Worker middleware |
| I2 | Every query filters on `agency_id` | Worker query layer |
| I3 | Unapproved proposal terms never leave the server for a borrower | Worker serialiser |
| I4 | A component never constructs an API URL | Service layer |
| I5 | Money is transported as integer pesewas | Service types |
| I6 | Duplicate submits cannot create duplicate applications | `Idempotency-Key` + D1 unique index |

---

## 5. Verification

```bash
cd frontend
npm run lint
npm run build
node --experimental-strip-types --test tests/*.test.ts
```

Additional integration checks once the Worker is deployed:

- [ ] `POST /applications` twice with the same `Idempotency-Key` → one row, identical response.
- [ ] Authenticated borrower listing returns only their own applications.
- [ ] Agency user from tenant B receives `404`/empty for tenant A resources.
- [ ] `VITE_API_BASE` unset → the app shows a configuration error, not a silent fallback.
- [ ] Expired token → single refresh, then redirect to landing.

---

## 6. Remaining work

- [ ] Implement `services/http.ts` and migrate components off `src/lib/api.ts` and `src/api/client.ts`.
- [ ] Remove the Convex provider (`src/lib/convex.tsx`) once the Worker is live.
- [ ] Add optimistic-update rollback on failed mutations.
- [ ] Add loading, empty, error and permission-denied states to every list view.
- [ ] Replace the mock calculator toggle with the live workflow once `POST /applications` exists.
