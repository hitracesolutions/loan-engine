# CLOUDFLARE MIGRATION PLAN

**Repository:** `hitracesolutions/loan-engine`
**Specification:** `Gidfine_Dev_Guide.md` v1.2
**Target stack:** Cloudflare Pages · Workers · D1 · R2 · Durable Objects · KV · Queues · Workers AI
**Date:** 27 October 2026
**Status:** 📐 Approved target — no Cloudflare runtime is merged yet.

---

## 1. Why migrate

The migration record covers the former overlapping backends: a retired Python/FastAPI + LangGraph service, an interim Convex backend, and legacy REST clients in the SPA. The Python service has since been removed from the working tree; see [`PYTHON_BACKEND_DECOMMISSION.md`](../PYTHON_BACKEND_DECOMMISSION.md).

| Problem | Consequence |
| --- | --- |
| Python runtime (FastAPI, LangGraph, Motor, Redis, ReportLab) | Cannot run on Cloudflare; separate host, separate secrets, separate scaling |
| Convex backend | Second vendor and a second data plane; no Cloudflare-native identity, R2 or Queues |
| Legacy REST/WebSocket clients hard-coded to `nbfc-inc.onrender.com` | Production traffic depends on a Hostinger/Render-era deployment |
| Three sources of truth for the loan state machine | Divergent rules between Python, Convex and the UI |

The target is **one** runtime, **one** data plane, **one** state machine — all on Cloudflare.

---

## 2. Principles

1. **Single runtime.** TypeScript on Workers. No Python, no second backend vendor.
2. **Server is authoritative.** Every financial, approval and disclosure rule is enforced in the Worker.
3. **Edge-first.** The SPA ships from Pages; the API executes near the user; no origin server to patch.
4. **Deterministic money.** Integer pesewas and basis points in D1, never floats.
5. **Immutable history.** Append-only `audit_events` and journal rows; corrections are compensating entries.
6. **No big-bang cutover.** Each phase is independently deployable and reversible.

---

## 3. Current state → target state

| Capability | At migration start | Target | Status |
| --- | --- | --- | --- |
| Web app | React 19 + Vite in `frontend/` | Same, deployed to **Cloudflare Pages** | ⬜ Pages project pending |
| Hosting config | `frontend/vercel.json` | Pages project + `frontend/public/_redirects` | ✅ Vercel removed, `_redirects` added |
| HTTP API | Retired FastAPI service + Convex | `workers/api` (Worker) | 🟡 health, auth, applications |
| Real-time chat | FastAPI WebSocket + Convex reactivity | Durable Object `LoanSession` (WebSocket hibernation) | ⬜ |
| Database | MongoDB Atlas + Convex DB | **D1** (`gidfine-db`) | 🟡 core tables migrated |
| Documents | GridFS | **R2** (`gidfine-documents`) with signed URLs | ⬜ |
| Cache | Redis | **KV** + Cache API | ⬜ |
| Background work | In-process `asyncio` + cron | **Queues** + **Cron Triggers** | ⬜ |
| LLM / OCR | LangChain → Groq/Gemini/OpenRouter | **Workers AI** + **AI Gateway** | ⬜ |
| PDF letters | ReportLab (Python) | `pdf-lib` in the Worker | ⬜ |
| Auth | Session-based + OTP | JWT (`jose`) + PBKDF2 via Web Crypto; optional Cloudflare Access for staff | ✅ JWT + PBKDF2 |
| Tests | pytest (Python) | `node:test` with `--experimental-strip-types` | ✅ 34 Worker + 52 frontend |

---

## 4. Source → target mapping

| Source | Target |
| --- | --- |
| Former `master_router.py` | `workers/api/src/domain/stateMachine.ts` + route dispatch |
| Former `intent_agent.py` | `workers/api/src/domain/intent.ts` |
| Former `sales_agent.py` | `workers/api/src/routes/chat.ts` + `durable/loanSession.ts` |
| Former `document_agent.py` | `workers/api/src/jobs/ocr.ts` + R2 |
| Former `kyc_agent.py`, `fraud_agent.py` | `workers/api/src/domain/kyc.ts`, `domain/fraud.ts` |
| Former `underwriting.py`, `financial_rules.py` | `workers/api/src/domain/underwriting.ts`, `domain/pricing.ts` |
| Former `pdf_generator.py` | `workers/api/src/lib/pdf.ts` |
| Former `emi_engine.py`, `repayment_agent.py` | `workers/api/src/domain/allocation.ts` + ledger tables |
| `frontend/convex/schema.ts` | `workers/api/migrations/*.sql` |
| `frontend/convex/loans.ts` | `workers/api/src/routes/applications.ts`, `proposals.ts`, `approvals.ts`, `lender.ts` |
| `frontend/convex/ledger.ts` | `workers/api/src/routes/ledger.ts` + `domain/allocation.ts` |
| `frontend/src/services/loanService.ts` (Convex adapter) | HTTP client against `VITE_API_BASE` |
| `frontend/src/lib/api.ts`, `src/api/client.ts`, `src/api/websocket.ts` | Consolidated into the typed service layer |

---

## 5. Phases

### Phase 0 — Freeze and inventory ✅

- [x] Branch protection on `main`; migration work on a feature branch.
- [x] Python backend removed from the working tree after decommission documentation was written.
- [x] Docs rebased onto Cloudflare (this directory + README + Dev Guide).
- **Exit criterion:** no build, test or deploy path references Python.

### Phase 1 — Worker skeleton and D1 schema ✅

- [x] `workers/api` with Wrangler config, `nodejs_compat`, observability, staging + production envs.
- [x] `GET /health` (liveness + D1 probe), unified JSON error envelope, CORS allow-list, request ids.
- [x] `0001_core.sql` — agencies, users, `loan_applications`, `idempotency_keys`, `audit_events`, with tenancy indexes and CHECK constraints.
- [x] State machine and guards ported to `domain/stateMachine.ts` with a `node:test` suite.
- [x] `wrangler types` generated bindings; `AppEnv` narrows them.
- **Exit criterion:** met locally — 34 Worker tests, `tsc --noEmit` clean, `wrangler dev` verified end to end. Staging deploy still pending (see Phase 7).

### Phase 2 — Identity and tenancy 🟡

- [x] `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
- [x] PBKDF2-HMAC-SHA-256 (210k iterations, per-user salt) via Web Crypto; HS256 access tokens via `jose`.
- [x] Middleware resolves `{ userId, agencyId, role }` from the token only.
- [x] Constant response for unknown-user and wrong-password; disabled-account check.
- [ ] `POST /auth/refresh` / `POST /auth/logout` with refresh-token rotation.
- [ ] Rate-limit auth routes with the Cloudflare rate-limiting binding.
- **Exit criterion:** partially met — unauthenticated calls return `401` and cross-tenant actors are rejected in the state-machine suite; refresh/logout and rate limits outstanding.

### Phase 3 — Loan workflow API 🟡

- [x] `POST /applications` (borrower submit, idempotent), `GET /applications` (borrower own / agency queue).
- [ ] `POST /applications/:id/proposals` (agency proposes terms, versioned).
- [ ] `POST /proposals/:id/decision` (assigned lender accepts/declines).
- [ ] `POST /applications/:id/approval` (agency approval — blocked without lender acceptance).
- [ ] `POST /applications/:id/consent` (borrower affirmative consent + SHA-256 terms snapshot).
- [ ] `GET /applications/:id/disbursement-readiness` (read-only audit).
- **Exit criterion:** the 8-step lifecycle passes the end-to-end security suite.

### Phase 4 — Documents, chat and async work 📐

- R2 upload with tenant-scoped keys and signed download URLs.
- OCR job via Queues → AI Gateway → Gemini Vision; results persisted to D1.
- `LoanSession` Durable Object: chat history, streaming tokens, agent-status events.
- **Exit criterion:** two concurrent sessions cannot read each other's transcript.

### Phase 5 — Ledger and disbursement 📐

- Journal tables, maker-checker disbursement, repayment allocation, reversals.
- Cron trigger for overdue sweeps and repayment reminders.
- Reconciliation query: debits = credits per transaction.
- **Exit criterion:** duplicate idempotency key cannot double-post; reversals balance.

### Phase 6 — Frontend cutover 🟡

- [x] React 19 + Vite SPA exists.
- [x] Delete `frontend/vercel.json`; add `frontend/public/_redirects`.
- [x] Single `VITE_API_BASE` resolution in `src/lib/config.ts` — the hard-coded Render host is gone, and the legacy REST/WebSocket clients now derive from it.
- [x] Remove the unverified OAuth identity fallback in `App.tsx` (query parameters are no longer treated as identity).
- [x] Repair `frontend/package-lock.json` so `npm ci`, `tsc -b` and the full test suite work.
- [ ] Replace the Convex adapter with the Worker HTTP client.
- [ ] Delete `frontend/convex/` and the Convex dependency.
- [ ] Point `VITE_API_BASE` at the Worker per environment in the Pages project.
- **Exit criterion:** `npm run build` and `node --test` pass with no Convex import; Pages preview works against staging.

### Phase 7 — Decommission and harden 📐

- Remove the archived Python tree from the working branch (keep a tagged release).
- Rotate all Render/MongoDB/Convex credentials.
- Enable Workers Logs, Tail Workers and alerting; document on-call runbook.
- Penetration test the tenancy and redaction boundaries.
- **Exit criterion:** production traffic served only by Cloudflare; legacy hosts shut down.

---

## 6. Data migration

1. **Export** source records by tenant (MongoDB `mongoexport` / Convex export).
2. **Transform** to SQL with a one-off script: ObjectId → ULID, `principalPesewas` remains integer, timestamps normalised to epoch milliseconds.
3. **Load** into staging D1 with `wrangler d1 execute gidfine-db-staging --file=seed.sql --remote`.
4. **Verify** counts and sums per table; reconcile the ledger to the pesewa.
5. **Sign off** before promoting to production.

Rules:

- Never import documents into D1 — they belong in R2.
- Never import plaintext passwords; require a reset flow at cutover.
- Keep the source export in an access-controlled bucket, not in git.

---

## 7. Cutover and rollback

**Cutover**

1. Deploy `workers/api` to production with D1 migrations applied.
2. Deploy the Pages production build with `VITE_API_BASE=https://api.gidfine.com`.
3. Smoke test: register → submit → propose → lender decision → approval → consent → readiness.
4. Monitor `wrangler tail` and Workers Analytics for 60 minutes.

**Rollback**

| Failure | Action |
| --- | --- |
| Worker error spike | `wrangler rollback` to the previous deployment |
| Bad migration | Roll forward with a corrective migration (D1 has no down-migrations) |
| Frontend regression | Pages → Deployments → roll back to the previous build |
| Total outage | Repoint the Pages `VITE_API_BASE` to the frozen legacy API and redeploy |

---

## 8. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| D1 write throughput per database | Contention during batch postings | Single-writer per session via Durable Object; bounded batch sizes |
| No interactive multi-statement transactions | Partial writes | `db.batch()` atomic batches; idempotency keys |
| Workers CPU limits | Slow OCR / PDF | Offload to Queues; stream uploads to R2 |
| Cold-start latency on DO | Chat lag | WebSocket hibernation; reconnect/backoff in client |
| Secrets sprawl | Credential leakage | `wrangler secret`, per-environment scopes, rotation schedule |
| Data migration loss | Financial misstatement | Row-count + sum reconciliation before cutover |

---

## 9. Decision log

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Retire Python entirely | Cannot run on Cloudflare; reduces to one language and one runtime |
| D2 | Retire Convex | Single vendor; identity, storage and queues become native Cloudflare |
| D3 | D1 over Hyperdrive/Postgres | Lowest operational overhead for the current data volume; revisit if write contention appears |
| D4 | Durable Object per loan session | Serialises chat writes; enables hibernating WebSockets |
| D5 | Integer pesewas / basis points | Deterministic financial arithmetic |
| D6 | AI Gateway in front of external models | Caching, retries, provider fallback and observability in one place |

---

## 10. Open questions

1. Does the business require a second D1 database per tenant, or is `agency_id` row-scoping sufficient?
2. Which identity provider backs staff MFA — Cloudflare Access, Google Workspace, or in-house TOTP?
3. Are sanction letters legally required to be generated server-side and retained in R2, or may they be generated client-side?
4. What retention period applies to KYC documents under Act 843?
5. Is a custom domain required for the API (`api.gidfine.com`) or is `workers.dev` acceptable for staging only?
