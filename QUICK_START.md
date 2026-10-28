# Gidfine Quick Start Guide

## 🚀 Start Local Development (2 minutes)

### Terminal 1: Start Worker API
```bash
cd workers/api
npm install    # First time only
npm run dev
```

**Expected Output:**
```
⛅️ wrangler 4.x.x
⎔ Starting local server...
[wrangler:info] Ready on http://127.0.0.1:8787
```

### Terminal 2: Test Admin Login
```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gidfine.com",
    "password": "Smooth@3251"
  }'
```

**Response (save the token!):**
```json
{
  "token": "eyJhbGc...",
  "user": { "id": "user_...", "email": "admin@gidfine.com" },
  "expires_in": 604800
}
```

### Terminal 3: Test API Endpoint
```bash
TOKEN="eyJhbGc..."  # From login response

curl -X GET http://localhost:8787/borrower/profile \
  -H "Authorization: Bearer $TOKEN"
```

✅ **All systems operational!**

---

## 📋 Admin Credentials

**Development (Local):**
```
Email:    admin@gidfine.com
Password: Smooth@3251
```

These are set in:
- `workers/api/.dev.vars` (for Worker)
- `.env.local` (for Frontend)

---

## 🔗 Available APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/auth/register` | POST | Register new borrower |
| `/auth/login` | POST | Login & get JWT |
| `/borrower/profile` | GET | Get profile |
| `/borrower/profile` | PUT | Update profile |
| `/borrower/applications` | GET | List applications |
| `/borrower/applications` | POST | Create application |
| `/borrower/loans` | GET | List loans |
| `/loans/:id` | GET | Get loan details |
| `/loans/:id/schedule` | GET | Repayment schedule |
| `/loans/:id/outstanding` | GET | Outstanding balance |
| `/loans/:id/payments` | POST | Submit payment |

---

## 📚 Full Documentation

- **Local Setup:** See `LOCAL_DEV_SETUP.md`
- **Admin Setup:** See `ADMIN_SETUP.md`
- **Architecture:** See `AGENTS.md`
- **Changes:** See `CHANGELOG.md`

---

## ⚠️ Important Notes

1. Admin user is **auto-created on first request**
2. Credentials from `.dev.vars` are used automatically
3. **All environment files are `.gitignore`d** (never commit credentials)
4. Database is local SQLite during development
5. Cache (KV) is also local

---

## 🆘 Troubleshooting

**Dev server won't start?**
```bash
pkill -f wrangler
rm -rf .wrangler
npm run dev
```

**Admin login fails?**
```bash
# Check admin user exists
wrangler d1 execute gidfine-db --local "
  SELECT email, role FROM staff_users WHERE role = 'PLATFORM_ADMIN'
"
```

**Database not found?**
```bash
# View databases
wrangler d1 list

# Create if missing
wrangler d1 create gidfine-db
wrangler d1 execute gidfine-db < schema.sql
```

---

## 📞 Next Steps

1. Test all API endpoints (use curl or Postman)
2. Start building frontend (React + Cloudflare Pages)
3. Implement lender/agency features
4. Add unit tests
5. Deploy to staging when ready

---

**Ready? Start Terminal 1 above! 🎯**
