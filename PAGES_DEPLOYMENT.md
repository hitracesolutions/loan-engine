# Cloudflare Pages Deployment Guide

## Overview
Gidfine consists of two separate deployments:
1. **API:** Cloudflare Workers (`workers/api/`) → temporary `workers.dev` hostname
2. **Frontend:** Cloudflare Pages (`frontend/`) → `gidfine.com`

This guide covers deploying the **Frontend** to Pages.

---

## Quick Deployment Steps

### Option 1: Cloudflare Dashboard (Recommended)

**Step 1: Connect GitHub Repository**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Pages → Create a project → Connect to Git
3. Select repository: `hitracesolutions/loan-engine`
4. Click Connect

**Step 2: Configure Build Settings**
1. **Project name:** `gidfine-web`
2. **Production branch:** `main` (or `development`)
3. **Framework preset:** `Vite` (auto-detected)
4. **Build command:** `npm run build`
5. **Build output directory:** `dist`
6. **Root directory:** `frontend`

**Important:** Set root directory to `frontend/` so Pages knows where to build from.

**Step 3: Set Environment Variables**
```
VITE_ENVIRONMENT = production
VITE_APP_NAME = Gidfine
```

For the current Pages Functions deployment, leave `VITE_API_BASE` and the
legacy `VITE_API_URL` unset in production. The frontend calls the API on the
Pages origin. Configure these Pages Functions bindings and secrets in the
Cloudflare dashboard: D1 `DB`, R2 `R2`, KV `CACHE`, and secrets
`JWT_SIGNING_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.

**Step 4: Save and Deploy**
- Click "Save and Deploy"
- First deployment starts automatically
- Monitor in Pages → gidfine-web → Deployments

---

### Option 2: Wrangler CLI

**Step 1: Create Pages Configuration**

In `frontend/wrangler.toml`:
```toml
name = "gidfine-web"
type = "javascript"
account_id = "9e1069f546a77c9ab4fe19d24ccf0a62"  # Your account ID
pages_build_output_dir = "dist"

[env.production]
routes = [
  { pattern = "gidfine.com", zone_name = "gidfine.com" }
]
vars = { VITE_ENVIRONMENT = "production", VITE_APP_NAME = "Gidfine" }

[env.staging]
routes = [
  { pattern = "staging.gidfine.com", zone_name = "gidfine.com" }
]
vars = { VITE_ENVIRONMENT = "staging", VITE_APP_NAME = "Gidfine" }
```

**Step 2: Deploy**
```bash
cd frontend
npm install
wrangler pages deploy dist --project-name gidfine-web
```

---

## Project Structure

```
loan-engine/
├── workers/api/          ← API (separate deployment)
│   ├── wrangler.toml    ← Workers config
│   └── src/
│
├── frontend/            ← Frontend (this section)
│   ├── wrangler.toml   ← Pages config (create this)
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   ├── dist/           ← Built by `npm run build`
│   └── tsconfig.app.json
│
└── wrangler.toml        ← Root (for Workers only)
```

---

## Build & Deployment Process

### Local Development
```bash
cd frontend
npm install
npm run dev
# Available at http://localhost:5173
```

### Production Build
```bash
cd frontend
npm install
npm run build
# Creates dist/ folder with optimized assets
```

### Deploy to Pages
**Via Dashboard:**
- Automatic on push to `main` or `development` branch

**Via CLI:**
```bash
wrangler pages deploy dist --project-name gidfine-web
```

---

## Environment Variables

### Development (Local)
See `.env.local` at project root:
```env
VITE_API_BASE=http://localhost:8787
VITE_ENVIRONMENT=development
VITE_APP_NAME=Gidfine
```

### Staging (Pre-production)
Set in Cloudflare Dashboard → Pages → gidfine-web → Settings → Environment:
```
VITE_API_BASE = https://gidfine-api-staging.YOUR_SUBDOMAIN.workers.dev
VITE_ENVIRONMENT = staging
VITE_APP_NAME = Gidfine (Staging)
```

### Production
Set in Cloudflare Dashboard → Pages → gidfine-web → Settings → Environment:
```
VITE_API_BASE = https://gidfine-api.YOUR_SUBDOMAIN.workers.dev
VITE_ENVIRONMENT = production
VITE_APP_NAME = Gidfine
```

---

## Custom Domains

### Set Production Domain
1. Pages → gidfine-web → Custom domains
2. Add domain: `gidfine.com`
3. Follow DNS configuration steps

### Set Staging Domain
1. Pages → gidfine-web → Custom domains
2. Add domain: `staging.gidfine.com`
3. Follow DNS configuration steps

---

## Routing & Redirects

Create `frontend/_redirects` for SPA routing:
```
/api/*  https://gidfine-api.YOUR_SUBDOMAIN.workers.dev/:splat  200
/*      /index.html                       200
```

This:
- Routes `/api/*` to the Workers API
- Routes all other paths to `index.html` (SPA)

---

## Troubleshooting

### Build Fails: "Cannot find module"
**Solution:**
```bash
cd frontend
npm install
npm run build
```

### Pages Can't Find Files
**Error:** `Failed: no such file or directory`

**Solution:**
1. Check Cloudflare Dashboard → Pages → gidfine-web → Settings
2. Verify **Build command:** `npm run build`
3. Verify **Build output directory:** `dist`
4. Verify **Root directory:** `frontend`

### API Calls Fail (CORS)
**Error:** `Access-Control-Allow-Origin` missing

**Solution:**
1. Add custom domain to Workers API
2. Configure CORS headers in `workers/api/src/index.ts`

Example:
```typescript
const response = new Response(JSON.stringify(data), {
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://gidfine.com",
  }
});
```

### Environment Variables Not Loaded
**Solution:**
1. Check `vite.config.ts` includes correct env prefix
2. Verify variables start with `VITE_`
3. Clear Cloudflare cache: Pages → Deployments → Re-deploy

---

## Monitoring & Analytics

### View Deployment Status
```
Pages → gidfine-web → Deployments
```

### View Logs
```
Pages → gidfine-web → Deployments → [deployment] → View Details
```

### Monitor Performance
```
Pages → gidfine-web → Analytics
```

---

## CI/CD Integration

### GitHub Actions Auto-Deploy
Cloudflare Pages automatically deploys on:
- Push to `main` (production)
- Push to `development` (staging)

To disable auto-deploy:
1. Pages → gidfine-web → Settings
2. Disable "Automatic Git deployments"

---

## Rollback

### Rollback to Previous Deployment
1. Pages → gidfine-web → Deployments
2. Find previous working deployment
3. Click the three dots → Rollback
4. Confirm

---

## Next Steps

1. **Configure Dashboard:**
   - Set GitHub connection
   - Configure build settings
   - Add environment variables

2. **Set Custom Domains:**
   - `gidfine.com` → Production
   - `staging.gidfine.com` → Staging

3. **Test Deployment:**
   - Push to GitHub
   - Verify Pages builds successfully
   - Test API integration

4. **Monitor:**
   - Watch deployments for errors
   - Check analytics
   - Monitor performance.

---

## Support

**Issues?**
1. Check Cloudflare Pages docs: https://developers.cloudflare.com/pages/
2. Review deployment logs in Dashboard
3. See QUICK_START.md for API testing
4. See AGENTS.md for architecture overview
