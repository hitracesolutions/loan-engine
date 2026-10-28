# Gidfine Admin User Setup Guide

## Overview
This guide covers creating the first Platform Admin user for Gidfine. The admin user is created automatically on the first Worker request using environment secrets.

---

## Quick Start (5 minutes)

### Step 1: Generate Secure Credentials
```bash
# Generate secure admin password (min 12 chars with special chars)
openssl rand -base64 12

# Or create one manually:
# Example: SecureAdminPassword123!
```

### Step 2: Set Admin Secrets
```bash
# Development
cd workers/api
wrangler secret put --env development ADMIN_EMAIL
# Enter: admin@gidfine.local

wrangler secret put --env development ADMIN_PASSWORD
# Enter: SecureAdminPassword123!

# Staging
wrangler secret put --env staging ADMIN_EMAIL
# Enter: admin@staging.gidfine.com

wrangler secret put --env staging ADMIN_PASSWORD
# Enter: (your secure password)

# Production
wrangler secret put --env production ADMIN_EMAIL
# Enter: admin@gidfine.com

wrangler secret put --env production ADMIN_PASSWORD
# Enter: (your secure password)
```

### Step 3: Deploy Worker
```bash
npm run deploy:prod
```

### Step 4: First Login
```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gidfine.com",
    "password": "SecureAdminPassword123!"
  }'

# Response:
# {
#   "token": "eyJhbGc...",
#   "user": { "id": "user_...", "email": "admin@gidfine.com" },
#   "expires_in": 604800
# }
```

### Step 5: Change Password Immediately ⚠️
After first login, change the admin password:

**API Endpoint (TODO - not yet implemented):**
```bash
curl -X PUT http://localhost:8787/admin/password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "current_password": "SecureAdminPassword123!",
    "new_password": "NewSecurePassword456!"
  }'
```

**Alternative - Direct Database Update:**
```bash
# SSH into Cloudflare D1 (or use wrangler)
wrangler d1 execute gidfine-db --remote "SELECT id FROM staff_users WHERE email = 'admin@gidfine.com';"

# Then update password (hash it first)
```

---

## Environment Variables

### ADMIN_EMAIL
- **Type:** Email string
- **Required:** No (if omitted, admin user won't be created)
- **When Set:** Created on first Worker request
- **Default:** None
- **Example:** `admin@gidfine.com`

### ADMIN_PASSWORD
- **Type:** Plain text password (hashed on storage)
- **Required:** No (must be provided with ADMIN_EMAIL)
- **Minimum:** 8 characters recommended, 12+ recommended
- **Special Characters:** Recommended for security
- **Never Stored:** Plain text is never logged or stored; only hash is kept in database
- **Example:** `SecureAdminPassword123!`

### How to Set Environment Secrets
```bash
# Development (local .dev.vars file)
cd workers/api
echo "ADMIN_EMAIL=admin@dev.gidfine.local" >> .dev.vars
echo "ADMIN_PASSWORD=LocalDevPassword123!" >> .dev.vars

# Staging/Production (Cloudflare secure storage)
wrangler secret put ADMIN_EMAIL --env staging
wrangler secret put ADMIN_PASSWORD --env staging

# View secrets (metadata only, not values)
wrangler secret list --env production
```

---

## Behind the Scenes

### How Admin User Creation Works

**Step 1: Worker Startup**
```typescript
export default {
  async fetch(request: Request, env: CloudflareEnv) {
    // Initialize admin user once on first request
    if (!adminInitialized) {
      adminInitialized = true;
      await initializeAdminUser(env);
    }
    return handleRequest(request, env);
  }
}
```

**Step 2: Check if Admin Exists**
```sql
SELECT id FROM staff_users 
WHERE email = ? AND role = 'PLATFORM_ADMIN'
```

**Step 3: Create Admin if Missing**
```sql
INSERT INTO staff_users (
  id, email, password_hash, full_name, role, status, mfa_enabled
) VALUES (
  'user_abc123...', 
  'admin@gidfine.com',
  'sha256_hash_of_password',
  'Platform Admin',
  'PLATFORM_ADMIN',
  'ACTIVE',
  FALSE
)
```

**Step 4: Log Result**
```
[ADMIN] Created admin user: admin@gidfine.com
[ADMIN] ⚠️  IMPORTANT: Change password immediately after first login!
```

---

## Security Considerations

### ✅ What's Secure
- Passwords are hashed with SHA-256 before storage
- Plain text credentials never logged or stored
- Secrets stored in Cloudflare's secure vault
- wrangler.toml never contains real credentials

### ⚠️ Known Limitations
- SHA-256 is acceptable for MVP, but bcrypt is recommended for production
- Initial password is only used once; change immediately
- No password reset functionality yet (TODO)
- No MFA enabled by default

### 🔒 Recommended Improvements
1. **Upgrade to bcrypt**
   - More resistant to brute force attacks
   - Adaptive hashing (slows down as hardware improves)

2. **Add password change endpoint**
   - Force password change on first login
   - Support password reset via email

3. **Enable MFA**
   - TOTP (Time-based One-Time Password) via Authy
   - Backup codes for account recovery

4. **Add email verification**
   - Confirm email ownership before granting access
   - Send welcome email with temporary login link

---

## Troubleshooting

### Problem: Admin User Not Created
**Symptom:** Login fails with "Invalid email or password"

**Solutions:**
1. Check secrets are set:
   ```bash
   wrangler secret list --env development
   ```

2. Verify environment variables:
   ```bash
   wrangler secret get ADMIN_EMAIL --env development
   wrangler secret get ADMIN_PASSWORD --env development
   ```

3. Check Worker logs:
   ```bash
   wrangler tail --env development
   ```

4. Manually create admin (if secrets were never set):
   ```bash
   wrangler d1 execute gidfine-db --remote "
     INSERT INTO staff_users (
       id, email, password_hash, full_name, role, status, mfa_enabled
     ) VALUES (
       'user_manual_admin_1',
       'admin@gidfine.com',
       'sha256_hash_here',
       'Platform Admin',
       'PLATFORM_ADMIN',
       'ACTIVE',
       FALSE
     )
   "
   ```

### Problem: Wrong Admin Email Set
**Solutions:**
1. Delete the admin user:
   ```bash
   wrangler d1 execute gidfine-db --remote "
     DELETE FROM staff_users WHERE email = 'wrong@email.com'
   "
   ```

2. Update secrets with correct email:
   ```bash
   wrangler secret put ADMIN_EMAIL --env production
   # Enter new email
   ```

3. Redeploy Worker:
   ```bash
   npm run deploy:prod
   ```

---

## Multi-Environment Setup

### Development (Local)
```bash
cd workers/api

# Add to .dev.vars
echo "ADMIN_EMAIL=admin@dev.gidfine.local" >> .dev.vars
echo "ADMIN_PASSWORD=DevPassword123!" >> .dev.vars

# Start dev server
npm run dev
```

### Staging (Pre-production)
```bash
wrangler secret put ADMIN_EMAIL --env staging
wrangler secret put ADMIN_PASSWORD --env staging

npm run deploy:staging
```

### Production
```bash
wrangler secret put ADMIN_EMAIL --env production
wrangler secret put ADMIN_PASSWORD --env production

npm run deploy:prod
```

---

## Testing Admin User

### Test Login
```bash
curl -X POST https://api.gidfine.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gidfine.com",
    "password": "SecureAdminPassword123!"
  }'
```

### Test Protected Endpoint (with JWT)
```bash
# Save token from login response
TOKEN="eyJhbGc..."

# Use token to access protected endpoint
curl -X GET https://api.gidfine.com/admin/users \
  -H "Authorization: Bearer $TOKEN"
```

### Verify Database Record
```bash
wrangler d1 execute gidfine-db --remote "
  SELECT id, email, role, status FROM staff_users 
  WHERE role = 'PLATFORM_ADMIN'
"
```

---

## Next Steps

After admin setup is complete:

1. **Create additional staff users** (loan officers, auditors)
2. **Configure lender accounts** (their login credentials)
3. **Set up agency policies** (interest rates, approval workflows)
4. **Enable MFA** for admin account
5. **Set up monitoring** to detect unauthorized access attempts

---

## Support

For issues or questions:
1. Check logs: `wrangler tail --env production`
2. Review database: `wrangler d1 shell gidfine-db`
3. See AGENTS.md for architecture overview
4. See CHANGELOG.md for implementation details
