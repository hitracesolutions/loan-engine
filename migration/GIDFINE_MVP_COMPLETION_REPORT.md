# GIDFINE — MVP SCOPE, ACCEPTANCE CRITERIA AND GO-LIVE READINESS

**Repository:** `hitracesolutions/loan-engine`
**Specification:** `Gidfine_Dev_Guide.md` v1.2
**Architecture stack:** Cloudflare Pages (React 19 + Vite) · Workers · D1 · R2 · Durable Objects
**Date:** 27 October 2026
**Status:** 🟡 In progress — auth + applications slice live on Cloudflare; remaining routes planned

> This record replaces the Convex-era MVP completion report of the same name. The PDF of the same name in this directory is superseded evidence.

---

## 1. Purpose

Define what "MVP complete" means for the Cloudflare platform, what is already in the repository, and what must be true before production traffic is accepted.

---

## 2. MVP scope

| # | Capability | Priority | State |
| --- | --- | --- | --- |
| 1 | Borrower registration, login, profile | Must | ✅ `POST /auth/register`, `/auth/login`, `GET /auth/me` |
| 2 | Borrower application submission (amount, tenure, purpose) | Must | ✅ `POST /applications` (idempotent) |
| 3 | Agency review queue and assignment | Must | 🟡 `GET /applications` returns the tenant queue; assignment pending |
| 4 | Lender onboarding, rate/product configuration | Must | 🟡 Mock data |
| 5 | Agency proposal to assigned lender (versioned) | Must | 🟡 UI ready; route pending |
| 6 | Lender accept / decline / counter | Must | 🟡 Accept/decline UI; route pending |
| 7 | Separate agency approval (no bypass) | Must | 🟡 Guard implemented + tested; route pending |
| 8 | Borrower affirmative consent + Act 843 snapshot hash | Must | 🟡 Hash implemented + tested; route pending |
| 9 | Field-level disclosure policies (lender/borrower) | Must | 📐 Designed |
| 10 | Disbursement with maker-checker | Must | 📐 Designed |
| 11 | Repayment entry, allocation, receipt, reversal | Must | 📐 Designed |
| 12 | Notifications (email/SMS) with delivery log | Must | ⬜ |
| 13 | Immutable audit trail | Must | 🟡 `audit_events` writing for registration + submission |
| 14 | Dashboards, ledger view, aging, export | Should | 🟡 UI ready |
| 15 | Payment gateway, mobile apps, credit scoring automation | Later | ⬜ |

---

## 3. Delivered in the repository

| Area | Evidence |
| --- | --- |
| Worker API | `workers/api/src/index.ts` — router, CORS allow-list, error envelope, request ids |
| Auth slice | `workers/api/src/routes/auth.ts`, `lib/auth.ts` (PBKDF2 + HS256 JWT) |
| Applications slice | `workers/api/src/routes/applications.ts` (submit + list, idempotent) |
| Loan state machine | `workers/api/src/domain/stateMachine.ts` + `workers/api/tests/stateMachine.test.ts` |
| D1 schema | `workers/api/migrations/0001_core.sql` |
| SPA shell and routing | `frontend/src/App.tsx`, `DashboardLayout.tsx` |
| Landing, auth, onboarding | `LandingPage.tsx`, `AuthModal.tsx`, `Onboarding.tsx` |
| Borrower workflow | `LoanApplication.tsx`, `BorrowerLoanManager.tsx` |
| Agency workflow | `AdminDashboard.tsx`, `AgencyReviewQueue.tsx` |
| Lender portal | `LenderPortal.tsx` |
| Cashier / ledger portal | `CashierLedgerPortal.tsx` |
| Analytics and reports | `AdminAnalytics.tsx`, `AnalyticsDashboard.tsx`, `ReportsPanel.tsx` |
| Chat surface | `ChatPane.tsx`, `AgentTypingIndicator.tsx`, `AgentOverlay.tsx` |
| Client state | `store/useLoanStore.ts` |
| API origin config | `frontend/src/lib/config.ts` |
| Automated tests | `workers/api/tests/*.test.ts` (34) and `frontend/tests/*.test.ts` (52) |
| Documentation | `README.md`, `Gidfine_Dev_Guide.md`, this directory |

Run the suites:

```bash
cd workers/api
npx tsc --noEmit
npm test

cd ../../frontend
npm run build
node --experimental-strip-types --test tests/*.test.ts
```

---

## 4. Not yet delivered

| Item | Blocking |
| --- | --- |
| ~~`workers/api` Worker (routes, auth, validation)~~ | ✅ health, auth, applications delivered; proposals/approvals/ledger outstanding |
| ~~D1 migrations and seed data~~ | ✅ `0001_core.sql` applied locally |
| R2 upload/download with signed URLs | KYC documents, sanction PDFs |
| `LoanSession` Durable Object | Live chat and agent status |
| Queue consumers (OCR, notifications, remittance) | Async work |
| Cron triggers (overdue sweep, reconciliation) | Servicing |
| Cloudflare Pages project | Production hosting (config and `_redirects` are ready) |
| Refresh/revocation tokens and rate limiting | Account security hardening |
| Removal of `frontend/convex/` | Single source of truth |

---

## 5. Acceptance criteria

| # | Criterion | Verification | State |
| --- | --- | --- | --- |
| A1 | An unauthorised user cannot read or export another tenant's data | Cross-tenant API tests | 🟡 Cross-tenant transitions rejected; route-level isolation tests pending |
| A2 | A lender request never returns borrower PII or agency margin | Payload diff test | ⬜ |
| A3 | Lender acceptance alone does not activate the loan | State-machine test | ✅ |
| A4 | Agency approval is required after lender acceptance | State-machine test | ✅ |
| A5 | Borrower consent is affirmative and hash-verified | Consent test | ✅ Hash determinism + tamper detection tested |
| A6 | Installments sum exactly to the approved total | Ledger arithmetic test | 🟡 `splitPesewas` invariant tested; ledger routes pending |
| A7 | A duplicate payment webhook cannot double-credit | Idempotency test | 🟡 Replay verified on `POST /applications` |
| A8 | An edited payment produces a reversal, not an overwrite | Reversal test | ⬜ |
| A9 | Every milestone writes an audit event | Audit query test | 🟡 Registration + submission verified in D1 |
| A10 | Deep links (`/docs`) resolve on Pages | Preview deploy check | 🟡 `_redirects` added; needs a live preview |
| A11 | Misconfiguration never targets a retired host | Source scan + config review | ✅ No hard-coded host; single resolution point |
| A12 | Secrets never appear in the bundle or logs | Bundle scan + log review | ✅ Secrets only via `wrangler secret` / `.dev.vars` |

---

## 6. Go-live checklist

**Platform**

- [ ] D1 production database created; migrations applied; backups/export schedule agreed.
- [ ] R2 buckets created; lifecycle and retention rules configured; public access disabled.
- [ ] KV namespaces and Queues created per environment.
- [x] Worker secrets set for local development; `.dev.vars` is git-ignored and absent from version control.
- [ ] Custom domains bound: `app.gidfine.com` (Pages), `api.gidfine.com` (Worker).
- [x] Workers Logs enabled (`observability` in `wrangler.jsonc`).
- [ ] Tail Workers and alerting configured.
- [ ] Rate limits configured on auth, OTP, upload and export routes.

**Application**

- [ ] `VITE_API_BASE` set for production and preview.
- [x] `frontend/public/_redirects` present.
- [ ] Convex provider and dependency removed.
- [ ] Legacy REST/WebSocket clients deleted.
- [x] `frontend/vercel.json` deleted.

**Assurance**

- [ ] All acceptance criteria above pass.
- [ ] [Phase 3C audit](GIDFINE_PHASE3C_SECURITY_AUDIT_REPORT.md) signed off with no open 🔴/🟠 findings.
- [ ] [Phase 4 ledger](GIDFINE_PHASE4_READINESS_REVIEW_REPORT.md) reconciliation green for 7 consecutive days in staging.
- [ ] Rollback rehearsed (Worker rollback + Pages rollback).
- [ ] Credentials from Render, MongoDB Atlas, Convex and Redis rotated or revoked.
- [ ] Legal sign-off on disclosures, consent copy and Act 843 retention.

---

## 7. Open decisions

Carried from Dev Guide Section 15 — these block completion:

1. Single-agency deployment or multi-tenant SaaS?
2. Does Gidfine arrange loans only, or also disburse and collect?
3. Rate basis and margin mechanics.
4. KYC document retention and access policy.
5. Who may approve a loan, change a rate, or reverse a payment (dual authorisation scope).
6. Payment channel for MVP (manual recording vs mobile money vs bank transfer).
7. Notification channels and who bears the cost.
