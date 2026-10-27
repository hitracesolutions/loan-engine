# Migration & Architecture Records

This directory holds the formal migration, design and audit records for the Gidfine loan platform.

**Current platform baseline:** Cloudflare — Cloudflare Pages (React 19 + Vite), Cloudflare Workers (TypeScript), D1, R2, Durable Objects, KV, Queues, Workers AI. There is no Python runtime.

---

## Status legend

| Symbol | Meaning |
| --- | --- |
| ✅ | Implemented and verified on the current branch |
| 🟡 | Partially implemented — see the individual record for what remains |
| 📐 | Design complete, implementation pending |
| ⬜ | Not started |
| 🗄️ | Superseded / archived for provenance only |

---

## Active records

| # | Document | Subject | Status |
| --- | --- | --- | --- |
| 1 | [CLOUDFLARE_MIGRATION_PLAN.md](CLOUDFLARE_MIGRATION_PLAN.md) | End-to-end migration from the Python/FastAPI + Convex implementation to Cloudflare; phases, cutover and rollback | 🟡 Phases 0–1 complete |
| 2 | [GIDFINE_PHASE3A_REACT_INTEGRATION_REPORT.md](GIDFINE_PHASE3A_REACT_INTEGRATION_REPORT.md) | React SPA ↔ Worker API integration, typed service boundary, borrower/agency UIs | 🟡 Transport config done; service layer pending |
| 3 | [GIDFINE_PHASE3B_LENDER_PORTAL_REPORT.md](GIDFINE_PHASE3B_LENDER_PORTAL_REPORT.md) | Lender portal, proposal workflow, server-side PII and margin redaction | 🟡 Portal UI implemented; server routes pending |
| 4 | [GIDFINE_PHASE3C_SECURITY_AUDIT_REPORT.md](GIDFINE_PHASE3C_SECURITY_AUDIT_REPORT.md) | End-to-end security audit: tenancy, redaction, state tampering, auth, rate limits | 🟡 High findings closed; full audit pending |
| 5 | [GIDFINE_PHASE4_READINESS_REVIEW_REPORT.md](GIDFINE_PHASE4_READINESS_REVIEW_REPORT.md) | D1 financial ledger, double-entry journal, maker-checker disbursement | 📐 Design complete |
| 6 | [GIDFINE_MVP_COMPLETION_REPORT.md](GIDFINE_MVP_COMPLETION_REPORT.md) | MVP scope, acceptance criteria and remaining work before go-live | 🟡 Auth + applications slice live |

---

## How to read these records

1. **Start with the migration plan.** It defines the phase order, the target resource layout and the cutover gates.
2. **Phase records (3A–4) describe one subsystem each.** They state the invariants that must hold, the D1/Worker design that satisfies them, and the verification steps to run.
3. **Where a record says "pending",** the design is agreed but the Cloudflare implementation is not merged. Treat the acceptance criteria as the definition of done.
4. **Every record assumes** [Gidfine_Dev_Guide.md](../Gidfine_Dev_Guide.md) v1.2 as the authoritative specification.

---

## Superseded evidence (PDF archive)

The PDFs in this directory are the original FastAPI/LangGraph and interim Convex audit records. They are retained **for provenance only** and do not describe the current or target architecture:

| PDF | Original subject |
| --- | --- |
| `MIGRATION_DIAGNOSIS_REPORT.pdf` | Vue/React build diagnosis |
| `PHASE_2_RESTORATION_REPORT.pdf` | React 19 build restoration |
| `PHASE_3_AUDIT_REPORT.pdf` | Runtime and API audit (FastAPI era) |
| `PHASE_4_INTEGRATION_REPORT.pdf` | Comparison endpoints (FastAPI era) |
| `PHASE_5_DECOMMISSIONING_REPORT.pdf` | FastAPI decommissioning assessment |
| `FINAL_CONVERSION_AND_PRUNING_REPORT.pdf` | Vue removal / React parity |
| `DEV_GUIDE_ALIGNMENT_AUDIT_REPORT.pdf` | Dev guide alignment (v1.1) |
| `CONVEX_FOUNDATION_REPORT.pdf` | Convex foundation |
| `CONVEX_FOUNDATION_VERIFICATION_AUDIT.pdf` | Convex verification audit |
| `CONVEX_CLOUD_READINESS_REPORT.pdf` | Convex cloud readiness |
| `MINI_SCALE_IMPLEMENTATION_READINESS_AUDIT.pdf` | Mini-scale workflow readiness |
| `GIDFINE_PHASE1_SCHEMA_STATE_MACHINE_REPORT.pdf` | Convex schema + state machine |
| `GIDFINE_PHASE2_MUTATIONS_REPORT.pdf` | Convex mutations |
| `GIDFINE_PHASE2_SECURITY_AND_PHASE3_READINESS_REPORT.pdf` | Convex security / Phase 3 readiness |
| `GIDFINE_PHASE3A_REACT_INTEGRATION_REPORT.pdf` | Convex-era React integration |
| `GIDFINE_PHASE3B_LENDER_PORTAL_REPORT.pdf` | Convex-era lender portal |
| `GIDFINE_PHASE3C_SECURITY_AUDIT_REPORT.pdf` | Convex-era security audit |
| `GIDFINE_PHASE4A_CORRECTION_PASS_REPORT.pdf` | Ledger correction pass |
| `GIDFINE_PHASE4A_LEDGER_SCHEMA_REPORT.pdf` | Convex ledger schema |
| `GIDFINE_PHASE4A_POST_IMPLEMENTATION_AUDIT_REPORT.pdf` | Convex post-implementation audit |
| `GIDFINE_PHASE4_READINESS_REVIEW_REPORT.pdf` | Convex Phase 4 readiness |
| `GIDFINE_PRE_PHASE4_WORKTREE_RECONCILIATION_REPORT.pdf` | Worktree reconciliation |
| `GIDFINE_FINAL_PRE_PUSH_RELEASE_AUDIT_REPORT.pdf` | Pre-push release audit |
| `GIDFINE_PHASE1_SCHEMA_STATE_MACHINE_REPORT.pdf` | Schema and state machine |
| `VUE_MIGRATION_PLAN.pdf` | Original Vue migration roadmap |

> The `.md` records in this directory supersede the PDFs of the same name. Do not cite the PDFs in new work.

---

## Change log

| Date | Change |
| --- | --- |
| 2026-10-27 | Rebased every record onto the Cloudflare platform; archived the Python backend to `archive/python-backend/`; renamed the Vue migration plan to `CLOUDFLARE_MIGRATION_PLAN.md`; replaced absolute `file:///…` links with repository-relative links. |
| 2026-10-27 | Implemented migration Phase 1: `workers/api` (health, auth, applications), D1 migration `0001_core.sql`, ported state machine with 34 tests, single `VITE_API_BASE` resolution, Pages `_redirects`, Vercel config removed, frontend lockfile repaired (52 tests green). |
