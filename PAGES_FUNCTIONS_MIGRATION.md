# Pages Functions migration

The active HTTP API now runs from the same Cloudflare Pages project as the React frontend.

## What moved

- `frontend/functions/health.ts` → `GET /health`
- `frontend/functions/auth/[[path]].ts` → `/auth/*`
- `frontend/functions/applications/[[path]].ts` → `/applications` and nested
  application review routes
- `frontend/functions/borrower/applications.ts` → `/borrower/applications`
- `frontend/functions/_shared/api.ts` reuses the existing Worker router and auth implementation from `workers/api/src/`

The frontend can use same-origin API requests. Remove `VITE_API_BASE` from the Pages production environment; do not set it to the Pages hostname.

## Pages bindings

`frontend/wrangler.toml` configures the current D1 and KV resources. R2 is not required by the active API routes and is intentionally not bound. Pages production secrets must be configured in the Cloudflare dashboard:

- `JWT_SIGNING_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

For local Pages Functions development, copy `frontend/.dev.vars.example` to `frontend/.dev.vars` and provide local values.

## Local development

From `frontend/`:

```powershell
npm.cmd run build
npx wrangler pages dev dist
```

The Pages Function routes are same-origin, so the login request is:

```text
POST http://localhost:<pages-port>/auth/login
```

The original standalone Worker in `workers/api/` remains useful for isolated API testing and deployment, but it is no longer required for the Pages frontend’s HTTP routes.

## Durable Objects

Durable Objects are intentionally not included in this migration. The repository currently declares a `CHAT_SESSION` binding but does not implement a `ChatSession` class or WebSocket route. If real-time chat is added later, it should remain a separate Durable Object Worker and be bound to Pages.
