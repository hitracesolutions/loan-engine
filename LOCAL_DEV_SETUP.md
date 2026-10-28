# Gidfine Local Development Setup

## Prerequisites
- Node.js 18+ ([download](https://nodejs.org/))
- Git
- Cloudflare Account (for wrangler login)

## Quick Start (10 minutes)

### 1. Clone & Install Dependencies
```bash
# Clone the repo
git clone https://github.com/hitracesolutions/loan-engine.git
cd loan-engine

# Install Worker dependencies
cd workers/api
npm install

# Install Frontend dependencies (if building UI)
cd ../../frontend
npm install
```

### 2. Local Environment Files
The project includes pre-configured environment files:

**Worker Development** (`workers/api/.dev.vars`):
```env
ADMIN_EMAIL=admin@dev.gidfine.local
ADMIN_PASSWORD=DevPassword123!
JWT_SIGNING_KEY=...
```

**Frontend Development** (`.env.local`):
```env
VITE_API_URL=http://localhost:8787
VITE_ADMIN_EMAIL=admin@dev.gidfine.local
VITE_ADMIN_PASSWORD=DevPassword123!
```

These files are **already created** and ready to use!

### 3. Authenticate with Cloudflare
```bash
cd workers/api
wrangler login
# Opens browser to authenticate with your Cloudflare account
```

### 4. Start the Development Server
```bash
cd workers/api
npm run dev

# Output should show:
# ⛅️ wrangler 4.x.x
# ⎔ Starting local server...
# [wrangler:info] Ready on http://127.0.0.1:8787
```

### 5. Test Admin Login
```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dev.gidfine.local",
    "password": "DevPassword123!"
  }'

# Response (save the token!):
# {
#   "token": "eyJhbGc...",
#   "user": { "id": "user_...", "email": "admin@dev.gidfine.local" },
#   "expires_in": 604800
# }
```

### 6. Test API Endpoints (with JWT token)
```bash
# Save token from login
TOKEN="eyJhbGc..."

# Test health check
curl http://localhost:8787/health

# Test protected endpoint (borrower profile)
curl -X GET http://localhost:8787/borrower/profile \
  -H "Authorization: Bearer $TOKEN"
```

✅ **You're ready to develop!**

---

## Environment Files Explained

### `.dev.vars` (Worker Development)
Located: `workers/api/.dev.vars`
- **Gitignored:** Yes (never commits local secrets)
- **When Used:** `npm run dev` (local development only)
- **Contains:**
  - `ADMIN_EMAIL` - Admin user email for local testing
  - `ADMIN_PASSWORD` - Admin password (development only)
  - `JWT_SIGNING_KEY` - Secret for signing JWT tokens

### `.env.local` (Project Root)
Located: `.env.local`
- **Gitignored:** Yes
- **When Used:** Frontend development, local testing
- **Contains:**
  - `VITE_API_URL` - Points to local Worker (http://localhost:8787)
  - `VITE_ADMIN_EMAIL` - For testing admin flows
  - `VITE_ADMIN_PASSWORD` - For testing admin flows

### `.env.example` (Template)
Located: `.env.example` (root)
- **Gitignored:** No (committed to repo)
- **Purpose:** Shows what environment variables are available
- **Not a real environment file** - use for reference only

---

## Development Workflow

### Terminal 1: Start Worker API
```bash
cd workers/api
npm run dev

# This starts the local Cloudflare Workers runtime
# API available at: http://localhost:8787
```

### Terminal 2: Start Frontend (Optional)
```bash
cd frontend
npm run dev

# This starts Vite dev server
# Frontend available at: http://localhost:5173
```

### Terminal 3: Test API (Optional)
```bash
# Save token from login
export TOKEN="eyJhbGc..."

# Test endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/borrower/profile
```

---

## Common Tasks

### Login & Get JWT Token
```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dev.gidfine.local",
    "password": "DevPassword123!"
  }' | jq '.token' -r > token.txt

# Now use it:
TOKEN=$(cat token.txt)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/borrower/profile
```

### Register New Borrower
```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "borrower@example.com",
    "password": "BorrowerPassword123!",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

### Create Loan Application
```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:8787/borrower/applications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_requested_pesewas": 50000000,
    "tenure_months": 12,
    "purpose": "Business expansion"
  }'
```

### Submit Payment
```bash
TOKEN="your_jwt_token_here"
LOAN_ID="loan_xyz123"

curl -X POST http://localhost:8787/loans/$LOAN_ID/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_pesewas": 5000000,
    "payment_method": "bank_transfer",
    "reference_number": "TXN_2024_001",
    "idempotency_key": "unique_payment_id_123"
  }'
```

---

## Database Access (D1)

### View Database Schema
```bash
wrangler d1 execute gidfine-db --local "
  SELECT name FROM sqlite_master WHERE type='table'
"
```

### Query Data
```bash
# List all borrowers
wrangler d1 execute gidfine-db --local "
  SELECT id, email, status FROM borrowers LIMIT 10
"

# List admin users
wrangler d1 execute gidfine-db --local "
  SELECT id, email, role FROM staff_users WHERE role = 'PLATFORM_ADMIN'
"

# List applications
wrangler d1 execute gidfine-db --local "
  SELECT id, borrower_id, amount_requested_pesewas, status 
  FROM applications 
  LIMIT 10
"
```

### Manual Admin Creation (if .dev.vars not used)
```bash
wrangler d1 execute gidfine-db --local "
  INSERT INTO staff_users (
    id, email, password_hash, full_name, role, status, mfa_enabled
  ) VALUES (
    'user_manual_admin',
    'admin@dev.gidfine.local',
    'sha256_hash_of_password',
    'Manual Admin',
    'PLATFORM_ADMIN',
    'ACTIVE',
    FALSE
  )
"
```

---

## Debugging

### View Worker Logs
```bash
# In terminal running `npm run dev`
# Logs appear automatically with [wrangler:info] prefix

# Or use wrangler tail
wrangler tail --env development
```

### Enable Debug Logging
In `.dev.vars`:
```env
LOG_LEVEL=debug
```

Then all console.log() calls will appear in logs.

### Check KV Cache
```bash
wrangler kv:key list --namespace-id 5886b255cb484f4ca24b5a566aafc80d
```

### Check Database Connection
```bash
# Test D1 connection
wrangler d1 execute gidfine-db --local "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"

# Should return: { "table_count": 17 }
```

---

## Troubleshooting

### Issue: Dev server crashes on startup
**Solution:**
```bash
# Kill any existing wrangler process
pkill -f wrangler

# Clear wrangler cache
rm -rf .wrangler

# Try again
npm run dev
```

### Issue: Database says "gidfine-db could not be found"
**Solution:**
```bash
# Check if database exists
wrangler d1 list

# If missing, create it
wrangler d1 create gidfine-db

# Apply schema
wrangler d1 execute gidfine-db < schema.sql
```

### Issue: Admin login fails
**Solution:**
1. Check .dev.vars exists with ADMIN_EMAIL and ADMIN_PASSWORD
2. View Worker logs: `wrangler tail`
3. Check if admin user was created in database:
   ```bash
   wrangler d1 execute gidfine-db --local "
     SELECT email, role FROM staff_users WHERE role = 'PLATFORM_ADMIN'
   "
   ```

### Issue: JWT token invalid or expired
**Solution:**
1. Generate new token:
   ```bash
   curl -X POST http://localhost:8787/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@dev.gidfine.local","password":"DevPassword123!"}'
   ```
2. Use the new token in the Authorization header

### Issue: CORS errors from frontend
**Solution:**
1. Check API_URL in `.env.local` matches running Worker
2. Add origin to wrangler.toml (if needed)
3. Frontend should be http://localhost:5173
4. API should be http://localhost:8787

---

## Performance Tips

### 1. Use KV Cache
The API caches reads for 1h-6h depending on data type. First request hits database, subsequent requests use cache.

### 2. Batch Requests
Instead of 10 separate requests, combine into 1 when possible.

### 3. Monitor Database Load
```bash
# Check query count
wrangler d1 execute gidfine-db --local "
  SELECT COUNT(*) FROM payment_transactions
"
```

### 4. Watch Memory Usage
Worker memory limit is 128MB. Monitor in logs for warnings.

---

## Production vs Development

| Feature | Development | Production |
|---------|-------------|-----------|
| Admin email | admin@dev.gidfine.local | admin@gidfine.com |
| Admin password | DevPassword123! | Secure random (set via wrangler secret) |
| API URL | http://localhost:8787 | https://api.gidfine.com |
| Database | Local (gidfine-db) | Remote (gidfine-db) |
| KV | Local | Remote |
| Logs | Console + tail | Cloudflare Dashboard |
| Secrets | .dev.vars file | Cloudflare secure vault |
| Debugging | Full logs | Limited (privacy) |

---

## Next Steps

1. **Test all API endpoints** - see CHANGELOG.md for list
2. **Build frontend** - start with borrower login and profile
3. **Implement lender portal** - see what endpoints are missing
4. **Write unit tests** - add test cases for handlers
5. **Deploy to staging** - test with real Cloudflare infrastructure

---

## Useful Links

- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)
- [Project CHANGELOG](./CHANGELOG.md)
- [Admin Setup Guide](./ADMIN_SETUP.md)
- [Agent Documentation](./AGENTS.md)

---

## Support

**Having issues?**
1. Check logs: `wrangler tail`
2. Read AGENTS.md for architecture
3. Review ADMIN_SETUP.md for admin user setup
4. Check LOCAL_DEV_SETUP.md (this file) for troubleshooting
