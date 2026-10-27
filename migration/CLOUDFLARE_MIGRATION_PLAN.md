# CLOUDFLARE MIGRATION PLAN

**Repository:** `hitracesolutions/loan-engine`
**Specification:** `Gidfine_Dev_Guide.md` v1.2
**Target stack:** Cloudflare Pages · Workers · D1 · R2 · Durable Objects · KV · Queues · Workers AI
**Date:** 27 October 2026
**Status:** 📐 Approved target — no Cloudflare runtime is merged yet.

---

## 1. Why migrate

The repository currently carries **three** overlapping backends: a retired Python/FastAPI + LangGraph service, an interim Convex backend, and legacy REST clients in the SPA. None of them is a durable production story:

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

| Capability | Today | Target |
| --- | --- | --- |
| Web app | React 19 + Vite in `frontend/` | Same, deployed to **Cloudflare Pages** |
| Hosting config | `frontend/vercel.json` | Pages project + `frontend/public/_redirects` |
| HTTP API | FastAPI (`archive/python-backend/`) + Convex | `workers/api` (Worker, `api.gidfine.com`) |
| Real-time chat | FastAPI WebSocket + Convex reactivity | Durable Object `LoanSession` (WebSocket hibernation) |
| Database | MongoDB Atlas + Convex DB | **D1** (`gidfine-db`) |
| Documents | GridFS | **R2** (`gidfine-documents`) with signed URLs |
| Cache | Redis | **KV** + Cache API |
| Background work | In-process `asyncio` + cron | **Queues** + **Cron Triggers** |
| LLM / OCR | LangChain → Groq/Gemini/OpenRouter | **Workers AI** + **AI Gateway** |
| PDF letters | ReportLab (Python) | `pdf-lib` in the Worker |
| Auth | Session-based + OTP | JWT (`jose`) + PBKDF2 via Web Crypto; optional Cloudflare Access for staff |
| Tests | pytest (Python) | `node:test` with `--experimental-strip-types` |

---

## 4. Source → target mapping

| Source | Target |
| --- | --- |
| `archive/python-backend/agents/master_router.py` | `workers/api/src/domain/stateMachine.ts` + route dispatch |
| `archive/python-backend/agents/intent_agent.py` | `workers/api/src/domain/intent.ts` |
| `archive/python-backend/agents/sales_agent.py` | `workers/api/src/routes/chat.ts` + `durable/loanSession.ts` |
| `archive/python-backend/agents/document_agent.py` | `workers/api/src/jobs/ocr.ts` + R2 |
| `archive/python-backend/agents/kyc_agent.py`, `fraud_agent.py` | `workers/api/src/domain/kyc.ts`, `domain/fraud.ts` |
| `archive/python-backend/agents/underwriting.py`, `utils/financial_rules.py` | `workers/api/src/domain/underwriting.ts`, `domain/pricing.ts` |
| `archive/python-backend/utils/pdf_generator.py` | `workers/api/src/lib/pdf.ts` |
| `archive/python-backend/agents/emi_engine.py`, `repayment_agent.py` | `workers/api/src/domain/allocation.ts` + ledger tables |
| `frontend/convex/schema.ts` | `workers/api/migrations/*.sql` |
| `frontend/convex/loans.ts` | `workers/api/src/routes/applications.ts`, `proposals.ts`, `approvals.ts`, `lender.ts` |
| `frontend/convex/ledger.ts` | `workers/api/src/routes/ledger.ts` + `domain/allocation.ts` |
| `frontend/src/services/loanService.ts` (Convex adapter) | HTTP client against `VITE_API_BASE` |
| `frontend/src/lib/api.ts`, `src/api/client.ts`, `src/api/websocket.ts` | Consolidated into the typed service layer |

---

## 5. Phases

### Phase 0 — Freeze and inventory ✅

- [x] Branch protection on `main`; migration work on a feature branch.
- [x] Python backend moved to `archive/python-backend/` (read-only).
- [x] Docs rebased onto Cloudflare (this directory + README + Dev Guide).
- **Exit criterion:** no build, test or deploy path references Python.

### Phase 1 — Worker skeleton and D1 schema 📐

- Create `workers/api` with Wrangler config, `nodejs_compat`, observability.
- Implement `GET /health`, structured error envelope, CORS allow-list, request IDs.
- Author migrations `0001_core.sql` … covering agencies, users, memberships, applications, documents, proposals, consents, approvals, audit.
- Port the state machine and guards to `domain/stateMachine.ts` with a `node:test` suite.
- **Exit criterion:** state-machine and schema tests green; `/health` deployed to staging.

### Phase 2 — Identity and tenancy 📐

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.
- PBKDF2-HMAC-SHA-256 (Web Crypto) password hashing; JWT access + refresh tokens.
- Middleware resolves `{ userId, agencyId, role }` from the token; **never** from the request body.
- Rate-limit auth and OTP routes with the Cloudflare rate-limiting binding.
- **Exit criterion:** unauthenticated and cross-tenant requests are rejected in tests.

### Phase 3 — Loan workflow API 📐

- `POST /applications` (borrower submit), `GET /applications` (borrower list).
- `POST /applications/:id/proposals` (agency proposes terms, versioned).
- `POST /proposals/:id/decision` (assigned lender accepts/declines).
- `POST /applications/:id/approval` (agency approval — blocked without lender acceptance).
- `POST /applications/:id/consent` (borrower affirmative consent + SHA-256 terms snapshot).
- `GET /applications/:id/disbursement-readiness` (read-only audit).
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

### Phase 6 — Frontend cutover ✅ / 📐

- [x] React 19 + Vite SPA exists.
- [ ] Replace the Convex adapter with the Worker HTTP client.
- [ ] Delete `frontend/convex/` and the Convex dependency.
- [ ] Delete `frontend/vercel.json`; add `frontend/public/_redirects`.
- [ ] Point `VITE_API_BASE` at the Worker per environment.
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
