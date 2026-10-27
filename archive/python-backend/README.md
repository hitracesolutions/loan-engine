# Archived: Python backend (retired)

This directory contains the original **FastAPI + LangGraph + MongoDB** implementation of Gidfine.

**It is not built, tested, deployed or imported by the product.** The platform runs entirely on Cloudflare (React + Vite on Pages, TypeScript Workers, D1, R2, Durable Objects).

## Why it is kept

- **Provenance** — the loan rules, prompts, fraud signals and pricing formulas in this code are the reference for behaviour the Cloudflare implementation must preserve.
- **Business-rule source** — underwriting thresholds, the 6-signal fraud score, EMI maths and lender ranking live here in readable Python.
- **Audit history** — the reports in [`migration/`](../../migration) cite files in this tree.

## What is here

| Path | Contents |
| --- | --- |
| `main.py` | FastAPI app entry point, CORS, WebSocket gateway |
| `config.py` | LLM provider fallback chain (Groq → Gemini → OpenRouter) and Redis cache setup |
| `mcp_server.py` | Model Context Protocol helper server |
| `agents/` | LangGraph nodes: intent, sales, document, KYC, fraud, underwriting, sanction, repayment, session manager, master graph/router |
| `api/` | Routers, Pydantic schemas, services and core helpers (auth, email, validation, websockets, state manager) |
| `db/` | MongoDB/Motor access, GridFS document storage, mock database |
| `mock_apis/` | Simulated lender feeds, credit bureau, bank verification, DigiLocker, OTP |
| `utils/` | Financial rules, loan ranking, eligibility, PDF generation, validators, analytics |
| `schemas/` | Agent output schemas |
| `tests/` | Python test fixtures |
| `requirements.txt`, `start.sh`, `.env.example` | Python dependency and runtime configuration |

## Rules

- **Do not import from this directory** in application code.
- **Do not run it in CI or add it to the deployment.**
- When a Cloudflare implementation must reproduce behaviour, port the rule to `workers/api/src/domain/` and cite the original file in the PR description.
- If a rule here conflicts with [Gidfine_Dev_Guide.md](../../Gidfine_Dev_Guide.md) v1.2, the Dev Guide wins.

## Where behaviour now lives

Paths marked ✅ exist in `workers/api` today; the rest are the planned home for the remaining port.

| Python module | Cloudflare replacement |
| --- | --- |
| `agents/master_router.py`, `master_graph.py` | ✅ `workers/api/src/domain/stateMachine.ts` + route dispatch |
| `agents/intent_agent.py` | `workers/api/src/domain/intent.ts` (Workers AI classification) |
| `agents/sales_agent.py` | `workers/api/src/routes/chat.ts` + Durable Object session |
| `agents/document_agent.py`, `api/services/document_service.py` | `workers/api/src/jobs/ocr.ts` (AI Gateway → Gemini Vision) + R2 |
| `agents/kyc_agent.py`, `agents/fraud_agent.py` | `workers/api/src/domain/kyc.ts`, `domain/fraud.ts` |
| `agents/underwriting.py`, `utils/financial_rules.py` | `workers/api/src/domain/underwriting.ts`, `domain/pricing.ts` |
| `agents/sanction_agent.py`, `utils/pdf_generator.py` | `workers/api/src/lib/pdf.ts` (`pdf-lib`) + R2 |
| `agents/emi_engine.py`, `agents/repayment_agent.py` | `domain/allocation.ts` + D1 ledger tables |
| `api/routers/auth.py`, `api/services/auth_service.py` | ✅ `workers/api/src/routes/auth.ts`, `src/lib/auth.ts` |
| `api/routers/session.py`, `api/services/session_service.py` | ✅ partially — `workers/api/src/routes/applications.ts` |
| `db/*`, `api/core/*` | ✅ partially — `workers/api/src/lib/*` + D1, KV, R2 bindings |
