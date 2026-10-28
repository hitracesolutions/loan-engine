# Python backend decommission record

**Status:** Removed from the working tree on 2026-10-28.

The former Python backend was a retired FastAPI application. It was not imported,
built, tested, or deployed by the current product. The active platform is React/Vite
on Cloudflare Pages with a TypeScript Cloudflare Worker API and D1.

## What the Python implementation did

| Area | Former responsibility | Current direction |
| --- | --- | --- |
| `main.py` | FastAPI app bootstrap, CORS, exception handling, REST router registration, and WebSocket endpoint | `workers/api/src/index.ts`, `src/router.ts`, and future Durable Objects |
| `agents/` | LangGraph orchestration for intent, sales, documents, KYC, fraud, underwriting, sanction, repayment, and session state | TypeScript Worker domain modules, routes, Workers AI, and Durable Objects as each workflow is ported |
| `api/routers/` | HTTP endpoints for auth, sessions, sales, documents, KYC, fraud, underwriting, sanction, advisory, payments, admin, and comparisons | `workers/api/src/routes/` and planned Worker routes |
| `api/schemas/` and `schemas/` | Pydantic request/response and agent-output models | TypeScript contracts and validation in `workers/api/src/` |
| `api/services/` and `api/core/` | Authentication, email, Redis caching, state management, WebSockets, document handling, payments, analytics, and business services | Worker libraries, D1, KV, R2, Queues, and Durable Objects |
| `db/` | MongoDB/Motor persistence, GridFS document storage, and mock database access | Cloudflare D1 for relational data and R2 for documents |
| `mock_apis/` | Simulated lender, credit bureau, bank verification, DigiLocker, OTP, and loan-product integrations | Worker integrations and test fixtures as those capabilities are implemented |
| `utils/` and `tools/` | Eligibility rules, financial calculations, lender ranking, PDF generation, analytics, validation, and search helpers | TypeScript domain and library modules; D1 ledger and `pdf-lib` where applicable |
| `tests/`, `requirements.txt`, `start.sh` | Python test fixtures, dependency installation, and local Uvicorn startup | Node/TypeScript tests and Wrangler scripts |

## Why it was removed

- It depended on FastAPI, LangGraph, MongoDB/Motor, Redis, Uvicorn, and ReportLab.
- It represented a second backend and a second source of truth for loan workflows.
- It could not be part of the Cloudflare-only deployment without maintaining a separate runtime.
- The current Worker already owns the active authentication and application routes.

The migration plan and this record preserve the architectural context without keeping
unused runtime code in the product repository. The Python implementation should not be
reintroduced as a fallback; any required behaviour should be reimplemented in the
TypeScript Worker and covered by its tests.
