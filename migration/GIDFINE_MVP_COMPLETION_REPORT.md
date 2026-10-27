# GIDFINE — MVP SCOPE, ACCEPTANCE CRITERIA AND GO-LIVE READINESS

**Repository:** `hitracesolutions/loan-engine`
**Specification:** `Gidfine_Dev_Guide.md` v1.2
**Architecture stack:** Cloudflare Pages (React 19 + Vite) · Workers · D1 · R2 · Durable Objects
**Date:** 27 October 2026
**Status:** 🟡 In progress — UI and test harness complete; Cloudflare runtime pending

> This record replaces the Convex-era MVP completion report of the same name. The PDF of the same name in this directory is superseded evidence.

---

## 1. Purpose

Define what "MVP complete" means for the Cloudflare platform, what is already in the repository, and what must be true before production traffic is accepted.

---

## 2. MVP scope

| # | Capability | Priority | State |
| --- | --- | --- | --- |
| 1 | Borrower registration, login, profile | Must | 🟡 UI ready, Worker pending |
| 2 | Borrower application submission (amount, tenure, purpose) | Must | 🟡 UI ready, Worker pending |
| 3 | Agency review queue and assignment | Must | 🟡 UI ready, Worker pending |
| 4 | Lender onboarding, rate/product configuration | Must | 🟡 Mock data |
| 5 | Agency proposal to assigned lender (versioned) | Must | 🟡 UI ready, Worker pending |
| 6 | Lender accept / decline / counter | Must | 🟡 Accept/decline UI; counter pending |
| 7 | Separate agency approval (no bypass) | Must | 🟡 Guarded in tests; Worker pending |
| 8 | Borrower affirmative consent + Act 843 snapshot hash | Must | 🟡 UI ready, Worker pending |
| 9 | Field-level disclosure policies (lender/borrower) | Must | 📐 Designed |
| 10 | Disbursement with maker-checker | Must | 📐 Designed |
| 11 | Repayment entry, allocation, receipt, reversal | Must | 📐 Designed |
| 12 | Notifications (email/SMS) with delivery log | Must | ⬜ |
| 13 | Immutable audit trail | Must | 📐 Designed |
| 14 | Dashboards, ledger view, aging, export | Should | 🟡 UI ready |
| 15 | Payment gateway, mobile apps, credit scoring automation | Later | ⬜ |

---

## 3. Delivered in the repository

| Area | Evidence |
| --- | --- |
| SPA shell and routing | `frontend/src/App.tsx`, `DashboardLayout.tsx` |
| Landing, auth, onboarding | `LandingPage.tsx`, `AuthModal.tsx`, `Onboarding.tsx` |
| Borrower workflow | `LoanApplication.tsx`, `BorrowerLoanManager.tsx` |
| Agency workflow | `AdminDashboard.tsx`, `AgencyReviewQueue.tsx` |
| Lender portal | `LenderPortal.tsx` |
| Cashier / ledger portal | `CashierLedgerPortal.tsx` |
| Analytics and reports | `AdminAnalytics.tsx`, `AnalyticsDashboard.tsx`, `ReportsPanel.tsx` |
| Chat surface | `ChatPane.tsx`, `AgentTypingIndicator.tsx`, `AgentOverlay.tsx` |
| Client state | `store/useLoanStore.ts` |
| Automated tests | `frontend/tests/*.test.ts` (`node:test`) |
| Documentation | `README.md`, `Gidfine_Dev_Guide.md`, this directory |

Run the suites:

```bash
cd frontend
npm run lint
npm run build
node --experimental-strip-types --test tests/*.test.ts
```

---

## 4. Not yet delivered

| Item | Blocking |
| --- | --- |
| `workers/api` Worker (routes, auth, validation) | Everything server-side |
| D1 migrations and seed data | Persistence |
| R2 upload/download with signed URLs | KYC documents, sanction PDFs |
| `LoanSession` Durable Object | Live chat and agent status |
| Queue consumers (OCR, notifications, remittance) | Async work |
| Cron triggers (overdue sweep, reconciliation) | Servicing |
| Cloudflare Pages project and `_redirects` | Production hosting |
| Removal of `frontend/convex/` and `frontend/vercel.json` | Single source of truth |

---

## 5. Acceptance criteria

| # | Criterion | Verification | State |
| --- | --- | --- | --- |
| A1 | An unauthorised user cannot read or export another tenant's data | Cross-tenant API tests | ⬜ |
| A2 | A lender request never returns borrower PII or agency margin | Payload diff test | ⬜ |
| A3 | Lender acceptance alone does not activate the loan | State-machine test | 🟡 |
| A4 | Agency approval is required after lender acceptance | State-machine test | 🟡 |
| A5 | Borrower consent is affirmative and hash-verified | Consent test | 🟡 |
| A6 | Installments sum exactly to the approved total | Ledger arithmetic test | ⬜ |
| A7 | A duplicate payment webhook cannot double-credit | Idempotency test | ⬜ |
| A8 | An edited payment produces a reversal, not an overwrite | Reversal test | ⬜ |
| A9 | Every milestone writes an audit event | Audit query test | ⬜ |
| A10 | Deep links (`/docs`) resolve on Pages | Preview deploy check | ⬜ |
| A11 | Production build fails without `VITE_API_BASE` | CI build check | ⬜ |
| A12 | Secrets never appear in the bundle or logs | Bundle scan + log review | ⬜ |

---

## 6. Go-live checklist

**Platform**

- [ ] D1 production database created; migrations applied; backups/export schedule agreed.
- [ ] R2 buckets created; lifecycle and retention rules configured; public access disabled.
- [ ] KV namespaces and Queues created per environment.
- [ ] Worker secrets set for production; `.dev.vars` absent from the repository.
- [ ] Custom domains bound: `app.gidfine.com` (Pages), `api.gidfine.com` (Worker).
- [ ] Workers Logs, Tail Workers and alerting enabled.
- [ ] Rate limits configured on auth, OTP, upload and export routes.

**Application**

- [ ] `VITE_API_BASE` set for production and preview.
- [ ] `frontend/public/_redirects` present.
- [ ] Convex provider and dependency removed.
- [ ] Legacy REST/WebSocket clients deleted.
- [ ] `frontend/vercel.json` deleted.

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
