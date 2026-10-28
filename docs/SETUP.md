# Gidfine Setup Guide — Single-Tenant Cloudflare Stack

## Overview

This guide sets up **Gidfine** as a single-tenant loan agency platform on **Cloudflare Pages + Workers + D1**.

**Stack:**
- Frontend: React 19 + Vite → Cloudflare Pages
- Backend: TypeScript Worker → Cloudflare Workers
- Database: D1 (SQLite)
- Storage: R2 (borrower documents, PDFs)
- Real-time: Durable Objects (chat sessions)
- Async: Queues + Cron Triggers (notifications, overdue sweeps)

---

## Prerequisites

1. **Node.js 18+**
   ```bash
   node --version  # Should be v18 or higher
   ```

2. **Cloudflare Account** (paid plan)
   - Sign up at https://dash.cloudflare.com
   - Create a new account or use existing

3. **Wrangler CLI**
   ```bash
   npm install -g wrangler
   wrangler --version
   ```

4. **GitHub Account** (for deployment)
   - Link your Gidfine repo to GitHub
   - Create a personal access token: https://github.com/settings/tokens

---

## Step 1: Cloudflare Setup

### 1.1 Get Your Account Details

```bash
# Login to Cloudflare
wrangler login

# Get your account ID
wrangler whoami
# Output: Account ID: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Copy this — you'll need it
```

### 1.2 Create D1 Database

```bash
# Create database
wrangler d1 create gidfine-db

# Note the database_id from output, then update wrangler.toml:
#   database_id = "YOUR_DATABASE_ID"

# Apply schema
wrangler d1 execute gidfine-db --file ./workers/api/schema.sql --remote

# Verify (list databases)
wrangler d1 list
```

### 1.3 Create R2 Bucket

```bash
# Create R2 bucket (from Cloudflare Dashboard)
# https://dash.cloudflare.com/?to=/:account/storage/r2/
# Name: gidfine-documents
# Region: auto

# Or via Wrangler (if supported):
wrangler r2 bucket create gidfine-documents
```

### 1.4 Create KV Namespace

```bash
# Create KV namespace
wrangler kv:namespace create CACHE

# Create binding in wrangler.toml:
# [[kv_namespaces]]
# binding = "CACHE"
# id = "YOUR_KV_ID"
# preview_id = "YOUR_KV_PREVIEW_ID"
```

### 1.5 Update `wrangler.toml`

```toml
[env.production]
  vars = { ENVIRONMENT = "production" }

[[d1_databases]]
binding = "DB"
database_name = "gidfine-db"
database_id = "PASTE_YOUR_ID_HERE"

[[r2_buckets]]
binding = "R2"
bucket_name = "gidfine-documents"

[[kv_namespaces]]
binding = "CACHE"
id = "PASTE_YOUR_ID_HERE"
```

### 1.6 Set Secrets

```bash
# JWT secret (generate a random string, e.g., via: openssl rand -hex 32)
wrangler secret put JWT_SECRET --env production
# Paste a random 32-character string

# Optional: Email & SMS providers
wrangler secret put SENDGRID_API_KEY --env production
wrangler secret put TWILIO_API_KEY --env production
```

---

## Step 2: Local Development

### 2.1 Install Dependencies

```bash
# Root dependencies
npm install

# Install global Wrangler (if not already)
npm install -g wrangler
```

### 2.2 Start Local Dev Servers

**Terminal 1 — Frontend (React)**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

**Terminal 2 — Worker (API)**
```bash
cd workers/api
npm install
npm run dev
# Runs on http://localhost:8787
```

### 2.3 Test API Locally

```bash
# Health check
curl http://localhost:8787/health

# Expected response:
# {"status":"ok"}
```

### 2.4 Local D1 Database

```bash
# Test database connectivity
wrangler d1 execute gidfine-db --file schema.sql

# Query data locally
wrangler d1 execute gidfine-db --local --command "SELECT * FROM agencies"
```

---

## Step 3: Frontend Setup

### 3.1 Environment Variables

Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8787
VITE_ENVIRONMENT=development
```

For production (`frontend/.env.production`):
```
VITE_API_URL=https://api.gidfine.com
VITE_ENVIRONMENT=production
```

### 3.2 Build Frontend

```bash
cd frontend
npm run build
# Outputs to: frontend/dist/
```

### 3.3 Deploy to Cloudflare Pages

```bash
# Push to GitHub first
git push origin main

# Then in Cloudflare Dashboard:
# https://dash.cloudflare.com/?to=/:account/pages/
# 1. Click "Create application"
# 2. Connect to GitHub (select your gidfine repo)
# 3. Set build settings:
#    - Framework: Vite
#    - Build command: npm run build
#    - Build output directory: frontend/dist
# 4. Deploy

# Or via Wrangler:
wrangler pages deploy frontend/dist --project-name gidfine-web
```

---

## Step 4: Worker/API Deployment

### 4.1 Build Worker

```bash
cd workers/api
npm run build
# Compiles TypeScript to JavaScript
```

### 4.2 Deploy to Production

```bash
# Deploy to production
wrangler deploy --env production

# Deploy to staging
wrangler deploy --env staging

# Verify deployment
curl https://api.gidfine.com/health
```

### 4.3 Check Deployment Status

```bash
# View deployment logs
wrangler tail --env production

# Or in Cloudflare Dashboard:
# https://dash.cloudflare.com/?to=/:account/workers/services
```

---

## Step 5: GitHub Actions CI/CD (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      
      - run: npm install
      
      - run: cd frontend && npm run build
      
      - name: Deploy Frontend to Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: gidfine-web
          directory: frontend/dist
      
      - name: Deploy Worker to Production
        run: npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Add secrets to GitHub:
- `CLOUDFLARE_API_TOKEN` — Create at https://dash.cloudflare.com/profile/api-tokens
- `CLOUDFLARE_ACCOUNT_ID` — Your account ID from wrangler

---

## Step 6: Data Backup & Recovery

### 6.1 Backup D1

```bash
# Export database
wrangler d1 execute gidfine-db --command ".dump" > backup.sql

# Restore from backup
wrangler d1 execute gidfine-db --file backup.sql
```

### 6.2 Backup R2 Documents

```bash
# List all documents
wrangler r2 object list gidfine-documents

# Download a document
wrangler r2 object get gidfine-documents/documents/loan-123/salary-slip.pdf
```

---

## Step 7: Monitoring & Debugging

### 7.1 View Worker Logs

```bash
# Live logs
wrangler tail --env production

# Filter by status code
wrangler tail --env production --status 500
```

### 7.2 View D1 Query Logs

```bash
# In Cloudflare Dashboard:
# https://dash.cloudflare.com/?to=/:account/workers/analytics
```

### 7.3 Debug Locally

```bash
# Enable verbose logging
wrangler dev --debug

# Test with curl
curl -v http://localhost:8787/health
```

---

## Step 8: Configuration Reference

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `ENVIRONMENT` | Dev/staging/prod | `production` |
| `JWT_SECRET` | Sign JWTs (set via secret) | — |
| `SENDGRID_API_KEY` | Email delivery | — |
| `TWILIO_API_KEY` | SMS delivery | — |

### D1 Tables (Key)

| Table | Purpose |
|-------|---------|
| `agencies` | Gidfine configuration |
| `borrowers` | Customer profiles |
| `lenders` | Partner banks |
| `applications` | Loan requests |
| `loans` | Active loans |
| `repayment_schedules` | Payment plans |
| `payment_transactions` | Recorded payments |
| `ledger_entries` | Immutable financial log |
| `audit_log` | All user actions |

---

## Troubleshooting

### Issue: Database not found
```bash
# Solution: Recreate database
wrangler d1 create gidfine-db
wrangler d1 execute gidfine-db --file schema.sql
```

### Issue: R2 access denied
```bash
# Solution: Check R2 API token in Cloudflare Dashboard
# https://dash.cloudflare.com/?to=/:account/storage/r2/settings
```

### Issue: Worker timeout
```bash
# Solution: Increase CPU time in wrangler.toml
[limits]
  cpu_milliseconds = 50000  # 50 seconds
```

### Issue: CORS errors in frontend
```bash
# Solution: Check CORS headers in Worker
# Ensure /middleware/cors.ts sets correct headers
```

---

## Next Steps

1. **Implement API endpoints** — Start with `/auth/register` and `/auth/login`
2. **Build database queries** — Create `src/db/` helper functions
3. **Add authentication** — Implement JWT middleware
4. **Build borrower portal** — React components for application
5. **Build agency portal** — Loan review queue, approvals
6. **Testing** — Write unit & integration tests

---

## Support

- **Cloudflare Docs:** https://developers.cloudflare.com/
- **Wrangler CLI:** https://developers.cloudflare.com/workers/wrangler/install-and-update/
- **D1 Guide:** https://developers.cloudflare.com/d1/
- **R2 Guide:** https://developers.cloudflare.com/r2/

---

**Last updated:** 2026-10-28
