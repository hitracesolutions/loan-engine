<div align="center">

# ⚡ Gidfine

### AI-Powered Loan Agency Management Platform

**Instant approval. Transparent pricing. Multi-lender marketplace.**

---

[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20Workers-orange?style=flat-square)](https://developers.cloudflare.com/)
[![React 19](https://img.shields.io/badge/React-19-blue?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Cloudflare D1](https://img.shields.io/badge/Database-D1%20%28SQLite%29-darkblue?style=flat-square)](https://developers.cloudflare.com/d1/)
[![Vite](https://img.shields.io/badge/Build-Vite-purple?style=flat-square)](https://vitejs.dev/)

</div>

---

## 🚀 What is Gidfine?

Gidfine is an **agency management platform** that simplifies loan origination by connecting borrowers, lenders, and agency staff in a transparent, auditable workflow.

- 📋 Borrowers submit applications with documents
- 🏦 Agency matches them to eligible lenders
- 💰 Transparent pricing with agency margin control
- ✅ Multi-stage approvals (lender → agency → borrower)
- 📊 Full audit trail and repayment tracking
- 🔐 Role-based access with field-level disclosure policies

**Built entirely on Cloudflare** — no traditional backend servers, fully serverless and edge-based.

---

## 🎯 The Problem We Solve

Loan intermediation in Ghana is fragmented and opaque:

| Challenge | Solution |
|-----------|----------|
| Manual lender matching | Agency portal with eligibility rules |
| Borrowers don't know real rates | Transparent pricing policy engine |
| Lost documents and endless re-uploads | Private document storage is planned behind an owner-approved R2 decision |
| No audit trail for compliance | Immutable ledger + approval workflow |
| Slow disbursement and repayment tracking | D1-backed servicing and notification workflows planned in phases |
| Lenders leak borrower information | Field-level disclosure policies enforced server-side |

**Result**: A loan moves from "submitted" to "active" in **days, not weeks**, with full visibility and control.

---

## 📦 Tech Stack

| Layer | Service | Why? |
|-------|---------|------|
| **Frontend** | React 19 + TypeScript + Vite | Modern, fast, responsive |
| **Deployment** | Cloudflare Pages | Global edge, zero-config git integration |
| **Backend API** | Cloudflare Pages Functions + shared Worker router | Same-origin serverless TypeScript API |
| **Database** | Cloudflare D1 (SQLite) | Relational, ACID, no ops |
| **Object Storage** | Deferred Cloudflare R2 | Add only when private documents/generated files are approved |
| **Real-time** | Not enabled | Durable Objects are deferred until a real-time requirement exists |
| **Cache** | Cloudflare KV | Rate cards, idempotency, repayment schedules |
| **Async Work** | Deferred Queues/Cron | Add for approved notifications and scheduled servicing jobs |
| **AI Inference** | Deferred Workers AI/AI Gateway | Not part of the MVP acceptance scope |
| **Auth** | Web Crypto PBKDF2 + application HS256 JWT | Active path uses the Web Crypto implementation |
| **Styling** | Tailwind CSS | Utility-first, responsive components |

**No Python runtime. No separate production API hostname. D1 is the system of record and is managed through versioned migrations.**

---

## 🏗️ Architecture

```
┌────────────────────────────────────────┐
│      Cloudflare Pages (Frontend)       │
│  React 19 + TypeScript + Vite + TailwindCSS
│  (dist/ served globally from edge)     │
└──────────────┬─────────────────────────┘
               │ Same-origin HTTP API
┌──────────────┴─────────────────────────┐
│ Pages Functions + shared TypeScript API │
│  - Authentication (JWT)                │
│  - Authorization (RBAC, disclosure)    │
│  - Loan lifecycle (origination, servicing)
│  - Financial calculations              │
│  - Audit logging                       │
└──────────────┬─────────────────────────┘
               │
       ┌───────┴────────┬──────────┬──────────┐
       │                │          │          │
   ┌───▼────┐      ┌───▼───┐  ┌──▼─────┐ ┌──▼────┐
       │  D1    │      │  R2   │  │   KV   │ │Future │
       │SQLite  │      │Deferred│ │ Cache  │ │ jobs  │
       │Database│      │       │  │        │ │       │
   └────────┘      └───────┘  └────────┘ └───────┘

     Durable Objects, Workers AI and external notifications are deferred
```

---

## 🎬 Getting Started

### Prerequisites
- **Node.js** 18+ (for local development)
- **Wrangler** CLI installed (`npm install -g wrangler`)
- **Cloudflare account** with a paid plan (for Workers + D1)
- **GitHub account** for Pages deployment

### Installation

```bash
# 1. Clone repository
git clone https://github.com/hitracesolutions/loan-engine.git
cd loan-engine

# 2. Install dependencies
npm install

# 3. Set up environment
cp wrangler.example.toml wrangler.toml
# Edit wrangler.toml with your Cloudflare account ID and bindings

# 4. Authenticate with Cloudflare
wrangler login

# 5. Create D1 database
wrangler d1 create gidfine-db

# 6. Apply schema
wrangler d1 execute gidfine-db --file schema.sql
```

### Running Locally

```bash
# Terminal 1 — Frontend (Vite dev server)
npm run dev:frontend
# App: http://localhost:5173

# Terminal 2 — Worker (local)
npm run dev:worker
# API: http://localhost:8787
```

### Deployment to Cloudflare

```bash
# Deploy frontend to Pages
wrangler pages deploy frontend/dist

# Deploy Worker API
wrangler deploy

# Or: use GitHub Actions for automated CI/CD
```

---

## ⚙️ Project Structure

```
loan-engine/
├── frontend/                      # React + Vite SPA
│   ├── src/
│   │   ├── components/            # Agency, Lender, Borrower portals
│   │   ├── pages/                 # Application, Dashboard, Profile
│   │   ├── api/                   # REST client
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── stores/                # Pinia/Zustand state
│   │   └── index.tsx              # Entry point
│   ├── public/                    # Static assets
│   └── package.json
│
├── workers/                       # Cloudflare Workers (TypeScript)
│   ├── api/
│   │   ├── src/
│   │   │   ├── handlers/          # REST endpoints
│   │   │   │   ├── auth.ts        # Login, register, JWT refresh
│   │   │   │   ├── borrowers.ts   # Applications, documents
│   │   │   │   ├── lenders.ts     # Proposals, acceptance
│   │   │   │   ├── agency.ts      # Review, matching, approval
│   │   │   │   ├── loans.ts       # Active loans, repayment
│   │   │   │   └── audit.ts       # Ledger, logs, exports
│   │   │   ├── middleware/        # Auth, CORS, error handling
│   │   │   ├── db/                # D1 queries (typed)
│   │   │   ├── rules/             # Pricing, eligibility, disclosure
│   │   │   ├── notifications/     # Event queue, email templates
│   │   │   └── index.ts           # Worker entry
│   │   ├── schema.sql             # D1 schema
│   │   └── wrangler.toml          # Worker config
│   │
│   └── durable-objects/           # Real-time session state
│       ├── ChatSession.ts         # Per-session WebSocket handler
│       └── RateLimiter.ts         # Token bucket per borrower
│
├── scripts/                       # Dev & ops
│   ├── seed-db.ts                 # Demo data loader
│   ├── migrate-schema.ts          # D1 migrations
│   └── backup-r2.ts               # Export borrower docs
│
├── docs/                          # Documentation
│   ├── Gidfine_Dev_Guide.md      # Full PRD + architecture
│   ├── API.md                     # Endpoint reference
│   ├── DB_SCHEMA.md               # Data model
│   └── DEPLOYMENT.md              # Cloudflare + GitHub Actions setup
│
├── wrangler.toml                  # Worker + D1 + R2 bindings
├── wrangler.example.toml          # Template (copy to wrangler.toml)
├── vite.config.ts                 # Frontend build config
└── package.json                   # Dependencies
```

---

## 💾 Database Schema (D1)

Core tables:
- `agencies` — Tenant (if multi-tenant) or single agency
- `users` — Staff (agency/lender) and borrowers
- `roles`, `permissions` — RBAC rules
- `applications` — Loan requests (DRAFT → CLOSED)
- `application_documents` — Uploaded files (R2 references)
- `lender_profiles` — Rates, limits, products
- `lender_proposals` — Agency-curated proposals to lenders
- `loans` — Active loans with approved terms
- `disbursements` — Funding records
- `repayment_schedules`, `repayment_installments` — Payment plans
- `payment_transactions` — Recorded payments
- `ledger_entries` — Immutable financial log
- `notification_events` — In-app, email, SMS queue
- `audit_events` — All user actions (immutable)
- `disclosure_policies` — Field visibility by role
- `interest_policies` — Versioned pricing rules

All monetary values in **integer minor units (pesewas)**. All rates in **integer basis points**.

---

## 🔐 Security & Compliance

- **Role-Based Access Control** enforced at every endpoint
- **Field-level disclosure policies** — borrower data hidden from lenders unless agency allows
- **Audit logging** — all approvals, rate changes, repayments, access
- **Immutable ledger** — financial transactions cannot be deleted, only reversed with audit trail
- **PBKDF2-HMAC-SHA-256** password hashing (Web Crypto)
- **JWT (Web Crypto)** — application-issued HS256 tokens with short-lived access
- **HTTPS only** — all Cloudflare traffic encrypted
- **D1 transactions** — ACID guarantees for financial ops
- **Data minimisation** — borrower documents in R2, not logs

---

## 📋 API Overview

### Authentication
```
POST   /auth/register         Register (borrower, staff)
POST   /auth/login            Login → JWT token
POST   /auth/refresh           Refresh expired token
POST   /auth/logout            Revoke session
```

### Borrower Portal
```
POST   /applications           Submit new loan request
GET    /applications/{id}      Check status
POST   /applications/{id}/docs Upload documents
GET    /loans                  View active loans
POST   /loans/{id}/pay         Record payment (agency posts)
GET    /repayments/{id}        Payment history
```

### Lender Portal
```
GET    /proposals              Assigned loan proposals
POST   /proposals/{id}/accept  Accept proposal
POST   /proposals/{id}/decline Decline
POST   /proposals/{id}/counter Counteroffer
GET    /loans                  Portfolio view (limited fields)
```

### Agency Portal
```
GET    /queue                  Application inbox
POST   /queue/{id}/assign      Assign lender
POST   /loans/{id}/approve     Final agency approval
POST   /loans/{id}/disburse    Confirm funding
GET    /reports                Portfolio analytics, exports
GET    /audit                  Immutable ledger
```

Current product specification: [Gidfine_Dev_Guide.md](./Gidfine_Dev_Guide.md)
Delivery sequence and owner decisions: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

---

## 🎓 Design Principles

### ✅ Transparent Pricing
- Lender rate + agency margin = borrower rate
- All policies versioned and frozen once accepted
- Borrower sees exact payment schedule before consent

### ✅ Strict Data Privacy
- Lender never sees borrower phone/address unless agency allows
- Borrower doesn't see lender rates or costs by default
- All disclosure rules server-enforced, not client-side

### ✅ Auditable Approvals
- No loan activates without: lender acceptance → agency approval → borrower consent
- Every decision logged with timestamp, user, reason
- Reversals create compensating ledger entries

### ✅ Immutable Ledger
- Financial events never deleted
- Interest, fees, repayments tracked by instalments
- Reporting runs against the ledger, not recalculated

### ✅ Serverless-First
- No ops overhead — Cloudflare handles scaling, backups, uptime
- Type-safe TypeScript throughout (frontend + Worker)
- Single deployment (`wrangler deploy` + Pages git push)

---

## 🛣️ Roadmap

- [x] Borrower registration, authentication and basic application slice
- [ ] Agency review queue + lender matching
- [ ] Lender proposals + acceptance workflow
- [ ] Pricing policy engine + quote versioning
- [ ] Approval workflow + borrower consent
- [ ] Disbursement confirmation
- [ ] Repayment ledger + receipts
- [ ] Immutable financial audit log
- [ ] Email notifications (SendGrid integration)
- [ ] SMS notifications (Twilio integration)
- [ ] PDF sanction/rejection letters
- [ ] Advanced analytics dashboard
- [ ] Multi-tenant (SaaS mode)
- [ ] Mobile app (React Native)
- [ ] Payment gateway integration (Paystack, mPesa)
- [ ] Credit scoring API

---

## 🤝 Contributing

The codebase is organized around `frontend/`, `frontend/functions/` and the
shared TypeScript API under `workers/api/`.

### Quick Start for Contributors
```bash
# Install
npm install

# Lint
npm run lint

# Type-check
npm run typecheck

# Test
npm run test

# Dev mode
npm run dev:frontend &
npm run dev:worker
```

### Code Standards
- **TypeScript strict mode** — no `any` types
- **Component-driven** — isolated, testable components
- **API contracts** — OpenAPI/Swagger for all endpoints
- **Database transactions** — atomic operations for ledger
- **Error handling** — user-friendly, not sensitive details

---

## 📚 Documentation

- **[Gidfine_Dev_Guide.md](./Gidfine_Dev_Guide.md)** — Complete PRD, data model, and business decisions
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — owner decisions, delivery phases and acceptance gates
- **[QUICK_START.md](./QUICK_START.md)** — local development and verification
- **[PAGES_DEPLOYMENT.md](./PAGES_DEPLOYMENT.md)** — current Pages bindings, secrets and deployment
- **[PAGES_FUNCTIONS_MIGRATION.md](./PAGES_FUNCTIONS_MIGRATION.md)** — same-origin API boundary

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

<div align="center">

**[📖 Full Docs](#-documentation) | [🐛 Report Issues](https://github.com/hitracesolutions/loan-engine/issues) | [💬 Discussions](https://github.com/hitracesolutions/loan-engine/discussions)**

Built with ❤️ for Ghana's lending ecosystem · **Fully serverless on Cloudflare**

</div>
