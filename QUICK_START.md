# Gidfine Quick Start

## Local development

Install dependencies once:

```powershell
cd frontend
npm install
```

For local Pages Functions, copy `frontend/.dev.vars.example` to
`frontend/.dev.vars` and set local values for `JWT_SIGNING_KEY`, `ADMIN_EMAIL`
and `ADMIN_PASSWORD`.

Local D1 migrations are applied automatically by `npm run dev:pages` through the
`predev:pages` script. To run them explicitly use `npm.cmd run db:migrate:local`.
Production migrations run from
[`.github/workflows/db-migrate.yml`](./.github/workflows/db-migrate.yml); the
manual equivalent is documented in
[`PAGES_DEPLOYMENT.md`](./PAGES_DEPLOYMENT.md#database-migrations). The Pages
build command must stay `npm run build` — it cannot apply migrations.

Start the frontend and Pages Functions in separate terminals:

```powershell
# Terminal 1
cd frontend
npm.cmd run dev

# Terminal 2, builds dist and applies local migrations first
cd frontend
npm.cmd run dev:pages
```

The Vite UI is normally available at `http://localhost:5173`. The Pages
Functions API is available on the Wrangler Pages dev port and uses same-origin
requests, for example:

```text
POST http://localhost:<pages-port>/auth/login
GET  http://localhost:<pages-port>/health
```

The standalone Worker under `workers/api/` can still be run for isolated API
testing:

```powershell
cd workers/api
npm install
npm.cmd run dev
```

## Production deployment

The production project is Cloudflare Pages `loan-engine` with repository root
`frontend`, build command `npm run build`, and output directory `dist`.

```powershell
cd frontend
npm.cmd run build
npx wrangler pages deploy dist --project-name loan-engine --branch main --commit-dirty=true
```

Production Pages bindings and secrets are documented in
[`PAGES_DEPLOYMENT.md`](./PAGES_DEPLOYMENT.md). Do not set `VITE_API_BASE` or
`VITE_API_URL` in production; the frontend uses the Pages Functions origin.

## Current API slice

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Health and D1 connectivity check |
| POST | `/auth/register` | Register a borrower account |
| POST | `/auth/login` | Authenticate and receive a JWT |
| GET | `/auth/me` | Read the authenticated user |
| POST | `/applications` | Create an application |
| GET | `/applications` | List the authenticated borrower’s applications |

The `/borrower/applications` aliases remain for compatibility with the current
frontend while the API client is consolidated.

## Verification

```powershell
cd workers/api
npm.cmd run typecheck
npm.cmd test -- --runInBand

cd ../../frontend
npm.cmd run build
```

## Documentation map

- Product requirements and current stack: [`Gidfine_Dev_Guide.md`](./Gidfine_Dev_Guide.md)
- Owner decisions and delivery phases: [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
- Owner decision records (ADR-0001 to ADR-0014): [`ADR/README.md`](./ADR/README.md)
- Pages deployment and bindings: [`PAGES_DEPLOYMENT.md`](./PAGES_DEPLOYMENT.md)
- Pages Functions migration notes: [`PAGES_FUNCTIONS_MIGRATION.md`](./PAGES_FUNCTIONS_MIGRATION.md)
- Change history: [`CHANGELOG.md`](./CHANGELOG.md)

Never commit `.env.local`, `.dev.vars`, tokens or passwords.
