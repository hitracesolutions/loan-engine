# Frontend API Migration Guide

## Overview
The frontend was originally built for a **FastAPI backend**. We've now migrated the backend to **Cloudflare Workers + D1 + KV**. This guide explains the changes and how to use the new API.

---

## What Changed

### Old API (FastAPI)
```javascript
// Used FormData for requests
const formData = new FormData();
formData.append('phone', '9876543210');
formData.append('password', 'password123');

fetch('/auth/login', {
  method: 'POST',
  body: formData
});

// Response format
{
  "success": true,
  "data": {
    "session_id": "...",
    "customer_data": {...}
  }
}
```

### New API (Cloudflare Workers)
```javascript
// Uses JSON for requests
fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

// Response format
{
  "token": "eyJhbGc...",
  "user": {
    "id": "user_...",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "expires_in": 604800
}
```

---

## New API Client

We've created `src/lib/api-gidfine.ts` which replaces the old `api.ts`:

### Import & Usage
```typescript
import { gidfineAPI } from './lib/api-gidfine';

// Login
const response = await gidfineAPI.login(email, password);
const token = response.token;
const user = response.user;

// Logout
gidfineAPI.logout();

// Check if authenticated
if (gidfineAPI.isAuthenticated()) {
  // User is logged in
}

// Get current token
const token = gidfineAPI.getToken();

// Set token manually (if needed)
gidfineAPI.setToken('eyJhbGc...');
```

---

## Available Endpoints

### Authentication
```typescript
// Login
await gidfineAPI.login(email, password)
// Returns: { token, user, expires_in }

// Register
await gidfineAPI.register(email, password, firstName, lastName)
// Returns: { token, user, expires_in }

// Logout
gidfineAPI.logout()
```

### Borrower Profile
```typescript
// Get profile
await gidfineAPI.getBorrowerProfile()

// Update profile
await gidfineAPI.updateBorrowerProfile({
  first_name: 'John',
  last_name: 'Doe',
  employer: 'Acme Corp',
  monthly_salary_pesewas: 500000
})
```

### Applications
```typescript
// List applications
await gidfineAPI.listApplications()
// Returns: [{ id, amount_requested_pesewas, status, ... }]

// Create application
await gidfineAPI.createApplication({
  amount_requested_pesewas: 50000000,  // GHS 500.00
  tenure_months: 12,
  purpose: 'Business expansion'
})

// Submit application
await gidfineAPI.submitApplication(applicationId)
```

### Loans
```typescript
// List loans
await gidfineAPI.listLoans()

// Get loan details
await gidfineAPI.getLoanDetails(loanId)

// Get repayment schedule
await gidfineAPI.getRepaymentSchedule(loanId)

// Get payment transactions
await gidfineAPI.getPaymentTransactions(loanId)

// Get outstanding balance
await gidfineAPI.getOutstandingBalance(loanId)
```

### Payments
```typescript
// Submit payment
await gidfineAPI.submitPayment(loanId, {
  amount_pesewas: 5000000,
  payment_method: 'bank_transfer',
  reference_number: 'TXN_2024_001',
  idempotency_key: 'unique_key_123'
})
```

---

## Key Differences

| Aspect | Old API | New API |
|--------|---------|---------|
| Request Format | FormData | JSON |
| Phone Parameter | ✅ Yes | ❌ No (use email) |
| Email Parameter | ❌ No | ✅ Yes |
| Auth Format | `phone` in FormData | `email` in JSON |
| Response Auth | `session_id` | `token` (JWT) |
| Headers | Form-encoded | JSON |
| Token Storage | Session-based | JWT in localStorage |
| Base URL | Relative paths | API_BASE + path |

---

## Migration Checklist

- [x] Create new `api-gidfine.ts` client
- [x] Update `AuthModal.tsx` to use new client
- [ ] Update other components using old API
- [ ] Update form validations for email (not phone)
- [ ] Update localStorage keys for JWT token
- [ ] Test all API endpoints
- [ ] Remove old `api.ts` when fully migrated

---

## Component Updates Needed

### AuthModal
- ✅ Already updated to use `gidfineAPI`
- ✅ Changed login parameter from `phone` to `email`
- ✅ Updated response handling for JWT tokens

### Other Components Using API
Search for `import { api }` and update:

```typescript
// OLD
import { api } from '../../lib/api';
const res = await api.loginWithPassword(phone, password);

// NEW
import { gidfineAPI } from '../../lib/api-gidfine';
const res = await gidfineAPI.login(email, password);
```

---

## Troubleshooting

### Login Still Failing?
1. **Check API_BASE is set:**
   ```
   Cloudflare Pages → gidfine-web → Settings → Environment
   VITE_API_BASE = https://api.gidfine.com
   ```

2. **Check browser console for error:**
   - Right-click → Inspect → Console
   - Look for fetch errors or CORS issues

3. **Verify backend is running:**
   ```bash
   curl http://localhost:8787/health
   # Should return: {"status":"ok"}
   ```

### CORS Errors?
**Error:** `Access-Control-Allow-Origin` missing

**Solution:**
The Workers API needs CORS headers. Check `workers/api/src/index.ts`:
```typescript
const response = new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://gidfine.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
});
```

### Token Not Persisting?
Check localStorage is available:
```javascript
// In browser console
localStorage.getItem('auth_token')
// Should return JWT token string
```

---

## Token Format

JWT tokens from Gidfine API are standard JSON Web Tokens:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiJ1c2VyXzEyMzQ1Njc4OTAiLCJyb2xlIjoiQk9SUk9XRVIiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20ifQ.
signed_signature_here
```

**Payload includes:**
- `sub` - User ID
- `role` - User role (BORROWER, LENDER, STAFF, ADMIN)
- `email` - User email
- `exp` - Expiration timestamp
- `iat` - Issued at timestamp

---

## Future Updates

As we implement more features in the Workers API, the `api-gidfine.ts` client will be updated with new methods:

- [ ] Lender endpoints (proposals, acceptance)
- [ ] Agency admin endpoints (approval queue)
- [ ] Document upload (uses R2)
- [ ] Fraud detection endpoints
- [ ] Analytics endpoints
- [ ] Admin dashboard endpoints

Each new feature will be added to the client for easy component integration.

---

## Support

**Need help?**
1. Check QUICK_START.md for API testing with curl
2. See AGENTS.md for architecture overview
3. Check CHANGELOG.md for what endpoints exist
4. Review worker logs: `wrangler tail`
