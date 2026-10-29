# Gidfine Changelog

## 2026-10-29 — Agency review workspace connection

- Connected the React agency review queue to server-side status filtering and
  the review API.
- Added assignment, guarded status decisions, internal notes and status-history
  viewing to the review dialog.
- Kept lender proposal, agency approval and disbursement actions gated until
  their Phase 3/4 backend and owner acceptance work is complete.

## 2026-10-29 — Agency review foundation

- Added the `0002_application_review.sql` migration for reviewer assignment,
  internal notes and append-only application status history.
- Added staff-only review queue filters, assignment, guarded status transitions
  and review evidence endpoints.
- Auditors retain read-only access; borrowers cannot access internal review
  notes or history.
- Applied the migration locally and verified the Worker typecheck, 51 API tests
  and frontend production build.

## 2026-10-29 — Owner decision baseline

- Recorded the owner’s Phase 0 decisions for tenancy, intermediary operation,
  lender/product pricing, fees, disclosures, documents, lender matching,
  approvals, repayments, notifications and generated documents.
- Marked Phase 1 implementation as unblocked while retaining detailed pricing,
  fee, disclosure and legal evidence fixtures as launch prerequisites.

## 2026-10-29 — Worker typecheck foundation

- Aligned the local D1 integration-test adapter with the generated Cloudflare
  D1 contracts and added session/metadata support.
- Worker typecheck now passes; the API test suite passes all 50 tests.

## 2026-10-29 — Ghana cedi display

- Replaced Indian rupee symbols and `en-IN` formatting across frontend loan,
  repayment, dashboard, advisor, sanction and comparison views with `GH₵` and
  Ghana-style formatting.
- Preserved the existing integer pesewas/GHS storage model and API contracts;
  no database migration is required for this display-only change.

## 2026-10-29 — Documentation and platform baseline

- Updated the development guide to reflect the current Cloudflare Pages +
  Pages Functions, D1 and KV deployment.
- Added `IMPLEMENTATION_PLAN.md` with owner decisions, delivery phases,
  migrations and acceptance gates.
- Consolidated local/deployment instructions around the `loan-engine` Pages
  project and same-origin API routes.
- Removed retired Python notes and superseded migration/setup archives.

## Version 1.0.0 (Current Development)

### Architecture Migration
**What Changed:** Migrated from Python/FastAPI backend to **Cloudflare Workers + D1 + R2 + KV** single-tenant architecture.

**Why:** 
- Serverless scales to zero (cost-efficient for MVP)
- No infrastructure management needed
- Single-tenant simplifies initial MVP
- Cloudflare edge network provides global low-latency access
- Built-in security, DDoS protection, and SSL

**Benefits:**
- Reduced operational overhead
- Faster deployment cycles (no server management)
- Built-in caching via KV for performance
- D1 provides SQLite with SQL syntax familiarity
- Easier to migrate to multi-tenant later if needed

### Project Structure
**What Was Done:**
```
workers/api/
├── src/
│   ├── handlers/        # Route handlers (auth, borrower, loan, payment)
│   ├── middleware/      # Rate limiting, fraud detection
│   ├── services/        # KV cache service, business logic
│   ├── utils/          # Response formatting, JWT, ID generation
│   ├── types.ts        # Complete TypeScript definitions
│   ├── index.ts        # Worker entry point & router
│   └── schema.sql      # D1 database schema (17 tables)
├── package.json        # Dependencies & scripts
├── tsconfig.json       # TypeScript configuration
└── wrangler.toml       # Cloudflare Worker config
```

### Database Schema (D1)
**What Was Created:** 17 tables organized into functional groups:

**Core Tables:**
- `agencies` - Single agency configuration (Gidfine)
- `borrowers` - Customer profiles
- `lenders` - Partner lender information
- `lender_products` - Lender-specific loan products
- `staff_users` - Internal staff with RBAC roles

**Origination:**
- `applications` - Loan applications (DRAFT → SUBMITTED → ACTIVE → PAID_OFF)
- `application_documents` - Uploaded borrower documents (stored in R2)
- `lender_proposals` - Lender responses to applications
- `loans` - Approved loans with terms and rates

**Servicing:**
- `repayment_schedules` - Monthly/installment schedules
- `payment_transactions` - Recorded payments
- `ledger_entries` - Immutable accounting ledger (prevents tampering)

**Compliance:**
- `audit_log` - All user actions logged for compliance
- `disclosure_policies` - Field-level visibility rules by role
- `interest_policies` - Configurable interest calculation methods
- `notification_events` - Email/SMS/WhatsApp queue

**Indexes:** 15 performance indexes on high-query columns

### API Endpoints
**What Was Implemented:**

**Authentication:**
- `POST /auth/register` - New borrower registration
- `POST /auth/login` - JWT token generation

**Borrower Portal:**
- `GET /borrower/profile` - User profile
- `PUT /borrower/profile` - Update profile (salary, employer)
- `GET /borrower/applications` - List all applications
- `POST /borrower/applications` - Create new application
- `POST /borrower/applications/:id/submit` - Submit for review
- `GET /borrower/loans` - List active loans

**Loan Management:**
- `GET /loans/:id` - Loan details (with KV caching)
- `GET /loans/:id/schedule` - Repayment schedule (1h cache)
- `GET /loans/:id/transactions` - Payment history
- `GET /loans/:id/outstanding` - Calculate remaining balance

**Payments:**
- `POST /loans/:id/payments` - Submit payment
- `GET /loans/:id/outstanding` - Outstanding balance calculation

### Services & Middleware

**KV Cache Service (`src/services/cache.ts`)**
- `cacheSet(env, key, value, ttl)` - Store with optional TTL
- `cacheGet(env, key)` - Retrieve from cache
- `cacheDelete(env, key)` - Remove from cache
- `cacheGetOrSet(env, key, fetchFn, ttl)` - Cache-aside pattern

**Cache TTLs:**
- Lender rates: 6 hours (changes daily)
- Repayment schedules: 1 hour (stable within day)
- Fraud scores: 30 minutes (recalculate frequently)
- Idempotency keys: 24 hours (prevent duplicate payments)

**Rate Limiting & Fraud Detection (`src/middleware/rate-limit.ts`)**
- Application submissions: 5/hour per borrower
- Document uploads: 20/hour per borrower
- Login attempts: 10/hour per IP
- Payment submissions: 10/day per borrower
- API calls: 60/minute per user
- Fraud scoring: Tracks excessive activity, data mismatches

**Utility Services:**
- `src/utils/auth.ts` - JWT creation/verification, password hashing
- `src/utils/response.ts` - Standardized API responses (success, error, 401, 429, etc.)
- `src/utils/id.ts` - Prefixed unique ID generation (borrower_*, loan_*, etc.)

### TypeScript Types
**What Was Defined:** Complete type safety with:
- Entity types (Agency, Borrower, Lender, Loan, etc.)
- Status enums (ApplicationStatus, LoanStatus, ProposalStatus)
- Request/Response DTOs (AuthRequest, CreateApplicationRequest, QuoteResponse)
- CloudflareEnv binding types
- Calculation types (EMICalculation, EligibilityResult, FraudScore)

### Configuration
**Environment Setup:**
- Created `.env.example` documenting all required secrets
- Configured `wrangler.toml` with:
  - D1 Database binding (fe4a9ac1-436a-42b3-b76b-ef79f7787420)
  - R2 Bucket binding (gidfine-documents)
  - KV Cache binding (5886b255cb484f4ca24b5a566aafc80d)
  - Queue for notifications
  - Durable Objects for chat/real-time
  - Cron triggers for scheduled tasks
  - Three environments: development, staging, production

### Security
**What Was Implemented:**
- ✅ Password hashing with SHA-256 (upgrade to bcrypt in production)
- ✅ JWT tokens with 7-day expiry
- ✅ Bearer token authentication on protected routes
- ✅ Immutable ledger for financial transactions (prevents tampering)
- ✅ Rate limiting to prevent abuse
- ✅ Fraud detection on excessive activity
- ✅ Role-based access control (BORROWER, LENDER, STAFF, ADMIN)
- ✅ Comprehensive `.gitignore` to prevent secret leaks
- ⚠️ TODO: Bcrypt for passwords, MFA for staff, 2FA for borrowers

### Financial Accuracy
**Monetary Values:**
- All amounts stored as **pesewas** (integer minor units)
- No floating-point arithmetic (prevents rounding errors)
- Example: GHS 100.00 = 10,000 pesewas

**Interest Rates:**
- All rates stored as **basis points** (1 bp = 0.01%)
- Example: 18% annual = 1,800 basis points
- Supports FLAT, REDUCING_BALANCE, EFFECTIVE_ANNUAL methods

### Testing Status
**What Works:**
- ✅ TypeScript compilation (zero errors)
- ✅ Build succeeds (57.52 KiB gzipped)
- ⚠️ Dev server builds, needs runtime testing
- ⚠️ TODO: Unit tests for handlers
- ⚠️ TODO: Integration tests with real D1
- ⚠️ TODO: API contract tests

### What's Next
**Immediate (Week 1):**
1. Debug dev server crash and fix runtime issues
2. Test all API endpoints with curl/Postman
3. Create R2 bucket for document storage
4. Implement document upload handler
5. Test KV caching with actual data

**Short Term (Weeks 2-3):**
1. Implement lender-side API (proposals, acceptance, disbursement)
2. Implement agency admin dashboard API (queue, approval)
3. Create automated EMI calculation service
4. Build eligibility checking (credit score, DTI ratio)
5. Add notification service (queue processing)

**Medium Term (Weeks 4-5):**
1. Create frontend (React + Cloudflare Pages)
2. Add borrower profile verification
3. Implement document upload and OCR verification
4. Build lender rate configuration UI
5. Create agency admin dashboard

**Long Term:**
1. Implement multi-tenant support (sub-agencies)
2. Add SMS/WhatsApp notifications
3. Build analytics dashboard
4. Implement webhooks for lender integrations
5. Add compliance reporting (CIC, NBFC regulations)

### Known Issues
1. **Dev server crashes** - Runtime error in handlers, needs debugging
2. **Password hashing** - Currently SHA-256, should use bcrypt
3. **Missing handlers** - Lender, agency, document upload not yet implemented
4. **No tests** - Need unit and integration tests
5. **No error pages** - Need 404, 500 error page handlers

### Dependencies
- **wrangler**: 4.42.0 - Cloudflare CLI
- **typescript**: 5.9.3 - Type safety
- **jose**: 6.1.0 - JWT handling
- **@cloudflare/workers-types**: 4.20240814.0 - Type definitions

### Git Commits
- `docs: add Gidfine setup guide for single-tenant Cloudflare stack`
- `config: add .gitignore and .env.example template`
- `config: update wrangler.toml with correct D1 database ID and cleanup`
- `chore: scaffold KV cache service and rate limiting middleware`
- `feat: implement REST API handlers for auth, borrower, loan, payment`
- `fix: resolve TypeScript compilation errors and type safety issues`
