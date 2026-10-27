# GIDFINE — PHASE 3B: LENDER PORTAL AND WORKFLOW

**Repository:** `hitracesolutions/loan-engine`
**Specification:** `Gidfine_Dev_Guide.md` v1.2
**Architecture stack:** React 19 + Vite (Cloudflare Pages) → Cloudflare Workers → D1
**Date:** 27 October 2026
**Status:** 🟡 Portal UI implemented; server-side redaction pending the Worker cutover

> This record replaces the Convex-era Phase 3B report of the same name. The PDF of the same name in this directory is superseded evidence.

---

## 1. Objective

Give institutional lenders a portal where they can review **only** the information the agency has chosen to disclose, and record an accept/decline decision that cannot bypass agency approval or borrower consent.

---

## 2. Portal surface

| Element | Behaviour |
| --- | --- |
| KPI header | Pending / accepted / declined counts and portfolio volume (GH₵, converted from pesewas for display only) |
| Proposal queue | Case reference, principal, base rate (% p.a.), tenure, status; filterable by `ALL / PENDING / ACCEPTED / DECLINED` |
| Proposal detail | Authorised fields only, with an explicit redaction notice |
| Accept / decline | Acceptance copy states that funding is subject to separate agency approval and affirmative borrower consent; decline requires a reason |
| Stale decision guard | A proposal that is already decided or superseded cannot be decided again |
| Portfolio | Assigned loans with permitted repayment status only |

Existing implementation: `frontend/src/components/LenderPortal.tsx`, mounted from `frontend/src/components/AdminDashboard.tsx`.

---

## 3. Redaction matrix

The Worker — not the React client — is responsible for every row below.

| Field | Agency | Lender | Borrower |
| --- | --- | --- | --- |
| Application id (internal) | ✅ | ❌ (use pseudonymous `case_id`) | ✅ |
| Case reference (`APP-XXXXXX`) | ✅ | ✅ | ✅ |
| Borrower name | ✅ | ❌ | ✅ (own record) |
| Borrower phone / email | ✅ | ❌ | ✅ (own record) |
| Borrower address / ID number | ✅ | ❌ | ✅ (own record) |
| KYC document contents | ✅ | ❌ | ✅ (own record) |
| Requested amount | ✅ | ✅ | ✅ |
| Lender base rate | ✅ | ✅ | ❌ until `AGENCY_APPROVED` |
| Agency margin (bps) | ✅ | ❌ | ❌ |
| Borrower rate (bps) | ✅ | ❌ | ✅ after `AGENCY_APPROVED` |
| Proposal version / history | ✅ | ✅ (own) | ❌ |
| Ledger / settlement detail | ✅ | ✅ (own loans) | ✅ (own receipts) |
| Audit events | ✅ (scoped) | ❌ | ❌ |

Implementation rules:

- Build the lender payload with an explicit `SELECT` column list — never `SELECT *` and delete keys afterwards.
- Redaction happens before serialisation, so omitted fields also vanish from logs and errors.
- Pseudonymous case references are stable per application, not per request.

---

## 4. Workflow guards

| Guard | Rule | Error |
| --- | --- | --- |
| Assigned lender only | `actor.userId === application.assigned_lender_id` | `FORBIDDEN` |
| Tenant match | `proposal.agency_id === actor.agency_id` | `NOT_FOUND` |
| Pending only | Proposal status must be `PENDING`; application must be `LENDER_PENDING` | `INVALID_STATE` |
| No approval bypass | `LENDER_ACCEPTED → BORROWER_ACCEPTED` is not a legal transition | `INVALID_STATE` |
| Consent integrity | Consent hash must match the approved terms version | `CONSENT_MISMATCH` |
| Decision is final | Re-deciding a decided or superseded proposal is rejected | `INVALID_STATE` |
| Read-only readiness | `GET /applications/:id/disbursement-readiness` performs no writes | — |

The transitions themselves live in the central state machine and are unit-tested independently of HTTP.

---

## 5. API surface

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/lender/proposals?status=` | `lender` |
| `GET` | `/lender/proposals/:id` | `lender` (assigned only) |
| `POST` | `/lender/proposals/:id/decision` | `lender` (assigned only) |
| `GET` | `/lender/portfolio` | `lender` |
| `GET` | `/applications/:id/disbursement-readiness` | `agency_admin`, `loan_officer`, `cashier` |

---

## 6. Verification

```bash
cd frontend
node --experimental-strip-types --test tests/*.test.ts
npm run build
```

Post-deployment checks:

- [ ] Lender payload contains no borrower `name`, `phone`, `email`, `id_number` or document keys.
- [ ] Lender payload contains no `agency_margin_bps` or `borrower_rate_bps`.
- [ ] Lender in tenant A receives zero rows for tenant B.
- [ ] Unassigned lender receives `403` on `POST /decision`.
- [ ] Accepting twice returns `INVALID_STATE`.
- [ ] Accepting does not move the application past `LENDER_ACCEPTED`.
- [ ] Readiness endpoint is idempotent and side-effect free (verify no new `audit_events` rows).

---

## 7. Remaining work

- [ ] Move the queue and detail queries from the Convex adapter to `frontend/src/services/lender.ts`.
- [ ] Add server-side pagination and cursor support to `/lender/proposals`.
- [ ] Add CSV export with redaction applied server-side.
- [ ] Add lender-side notification when a new proposal is assigned (Queues → email).
- [ ] Confirm with legal whether lender identity may be disclosed to the borrower in any state.
