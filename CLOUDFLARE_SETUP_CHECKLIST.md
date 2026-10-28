# Cloudflare Setup Checklist for Gidfine

**Your Account ID:** `e0d44c338559e3b675c16dad5ede700a`  
**Dashboard Link:** https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a

---

## ✅ Checklist: Complete in Order

### 1️⃣ D1 Database Setup

**In Cloudflare Dashboard:**
- [ ] Go to: https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/d1
- [ ] Click **"Create database"**
- [ ] Enter name: `gidfine-db`
- [ ] Select location: Auto
- [ ] Click **"Create"**
- [ ] **Copy the Database ID** (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**In your terminal:**
```bash
# Apply the schema
wrangler d1 execute gidfine-db --file workers/api/schema.sql --remote

# This will ask: "OK to execute this file?" → type `y` and press Enter
```

**In wrangler.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "gidfine-db"
database_id = "PASTE_ID_HERE"  # ← Paste your database ID here
```

---

### 2️⃣ R2 Object Storage Setup

**In Cloudflare Dashboard:**
- [ ] Go to: https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/storage/r2
- [ ] Click **"Create bucket"**
- [ ] Enter name: `gidfine-documents`
- [ ] Location: Auto
- [ ] Click **"Create bucket"**

**In wrangler.toml:**
```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "gidfine-documents"
account_id = "e0d44c338559e3b675c16dad5ede700a"
```

---

### 3️⃣ KV Cache Setup

**In Cloudflare Dashboard:**
- [ ] Go to: https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/workers/kv/namespaces
- [ ] Click **"Create namespace"**
- [ ] Enter name: `CACHE`
- [ ] Click **"Create"**
- [ ] **Copy the Namespace ID**
- [ ] (Optional) Create a preview namespace: `CACHE_preview`

**In wrangler.toml:**
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "PASTE_NAMESPACE_ID_HERE"
preview_id = "PASTE_PREVIEW_ID_HERE"  # (optional, for local testing)
```

---

### 4️⃣ API Token for Deployment

**In Cloudflare Dashboard:**
- [ ] Go to: https://dash.cloudflare.com/profile/api-tokens
- [ ] Click **"Create Token"**
- [ ] Use template: **"Edit Cloudflare Workers"**
- [ ] Or create custom with permissions:
  - ✅ Workers Scripts — Edit
  - ✅ Workers KV — Edit
  - ✅ Workers D1 — Edit
  - ✅ Account Settings — Read
- [ ] Set TTL: 90 days (or custom)
- [ ] Click **"Create Token"**
- [ ] **Copy the token** and save it securely

**You'll need this for:**
- GitHub Actions deployments
- `wrangler deploy` commands

---

### 5️⃣ Pages Deployment Configuration

**In your existing Pages project:**
- [ ] Go to: https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/pages/view/loan-engine
- [ ] Click **"Settings"** tab
- [ ] Scroll to **"Build settings"**
- [ ] Set:
  - **Build command:** `npm run build`
  - **Build output directory:** `frontend/dist`
  - **Node.js version:** 18.x (or 20.x)
- [ ] Click **"Save"**

**Set environment variables:**
- [ ] Click **"Environment variables"** tab
- [ ] Add for **Production:**
  - `VITE_API_URL` = `https://api.gidfine.com`
  - `VITE_ENVIRONMENT` = `production`
- [ ] Add for **Preview:**
  - `VITE_API_URL` = `https://api-staging.gidfine.com`
  - `VITE_ENVIRONMENT` = `staging`

---

### 6️⃣ Workers Subdomain Setup

**In Cloudflare Dashboard:**
- [ ] Go to: https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/workers/services
- [ ] Click on your worker service
- [ ] Go to **"Settings"** → **"Triggers"**
- [ ] Add routes:
  - `api.gidfine.com/*` → Production
  - `api-staging.gidfine.com/*` → Staging
  - `api-dev.gidfine.local/*` → Development (local only)

---

### 7️⃣ Queues Setup (Optional, for notifications)

**In Cloudflare Dashboard:**
- [ ] Go to: https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/workers/queues
- [ ] Click **"Create"**
- [ ] Create queue: `gidfine-notifications`
- [ ] Create DLQ (dead-letter queue): `gidfine-notifications-dlq`

---

### 8️⃣ Secrets Setup

**In your terminal:**
```bash
# Set JWT secret (for production)
wrangler secret put JWT_SECRET --env production
# Paste a random string (e.g., from: openssl rand -hex 32)

# Optional: Set email provider
wrangler secret put SENDGRID_API_KEY --env production
# Paste your SendGrid API key

# Optional: Set SMS provider
wrangler secret put TWILIO_API_KEY --env production
# Paste your Twilio API key
```

---

## 🚀 After Completing Checklist

### Test Locally
```bash
# Terminal 1 — Frontend
cd frontend && npm run dev
# → http://localhost:5173

# Terminal 2 — Worker
cd workers/api && npm run dev
# → http://localhost:8787

# Test health endpoint
curl http://localhost:8787/health
# Expected: {"status":"ok"}
```

### Deploy to Production
```bash
# Push to GitHub (if using Git)
git push origin main

# Or deploy directly
wrangler deploy --env production

# Verify
curl https://api.gidfine.com/health
```

---

## 📋 Dashboard Links (Quick Access)

| Component | Link |
|-----------|------|
| **D1 Databases** | https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/d1 |
| **R2 Buckets** | https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/storage/r2 |
| **KV Namespaces** | https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/workers/kv/namespaces |
| **Workers** | https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/workers/services |
| **Pages** | https://dash.cloudflare.com/e0d44c338559e3b675c16dad5ede700a/pages |
| **API Tokens** | https://dash.cloudflare.com/profile/api-tokens |

---

## ⚠️ Important Notes

1. **Database ID** — Copy from D1 page, paste into `wrangler.toml`
2. **KV Namespace ID** — Copy from KV page, paste into `wrangler.toml`
3. **Secrets** — Use `wrangler secret put` (not in wrangler.toml)
4. **API Token** — Save securely; use for GitHub Actions
5. **Account ID** — `e0d44c338559e3b675c16dad5ede700a` (already in links)

---

## ✅ Completion Status

- [ ] D1 database created and schema applied
- [ ] R2 bucket created
- [ ] KV namespace created
- [ ] API token generated
- [ ] Pages settings configured
- [ ] Workers routes set up
- [ ] Secrets added
- [ ] Local dev tested
- [ ] Production deployment verified

---

**Status:** Ready to start when you complete the checklist! 🚀
