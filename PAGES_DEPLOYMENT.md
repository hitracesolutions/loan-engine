# Cloudflare Pages Deployment

## Production project

- **Project:** `loan-engine`
- **Repository:** `hitracesolutions/loan-engine`
- **Root directory:** `frontend`
- **Build command:** `npm run build`
- **Build output:** `dist`
- **Production branch:** `main`
- **Current public URL:** `https://loan-engine.pages.dev`

Pages serves the React/Vite bundle and runs the API through Pages Functions in
`frontend/functions`. The Functions reuse the router in `workers/api/src`, so
production API calls are same-origin (`/auth/login`, `/applications`, etc.).
There is no required `api.gidfine.com` hostname.

## Dashboard settings

In Cloudflare Dashboard → Workers & Pages → `loan-engine`:

1. Keep the build settings above.
2. Enable automatic deployments from `main` if Git deployments are desired.
3. Configure the following production bindings:
   - D1 binding `DB` → `gidfine-db`
   - KV binding `CACHE` → the project’s `gidfine_kv` namespace
4. Configure these production secrets:
   - `JWT_SIGNING_KEY`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
5. Do not set `VITE_API_BASE` or `VITE_API_URL` for production builds. The
   frontend intentionally falls back to the Pages origin.
6. Keep the build command as `npm run build`. Never chain
   `wrangler d1 migrations apply` into it: Pages build containers carry no
   Cloudflare credentials, so the step fails with
   `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN`,
   and because it is chained with `&&` the frontend build never runs. Schema
   changes are applied by the workflow in
   [Database migrations](#database-migrations).

R2 is not bound because the current API does not upload or serve documents.
Provision it only when the owner-approved document requirements in
[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) are ready.

## Wrangler configuration

The Pages configuration is [frontend/wrangler.toml](./frontend/wrangler.toml).
It contains the Pages build directory, D1/KV bindings, non-secret variables and
the shared migration directory. Secrets must be set through Cloudflare, never
committed to TOML or `.env` files.

## Local Pages Functions

```powershell
cd frontend
npm install
Copy-Item .dev.vars.example .dev.vars
npm.cmd run dev:pages
```

`dev:pages` builds `dist`, applies pending local D1 migrations through its
`predev:pages` script, then starts `wrangler pages dev dist`.

Set local values in `frontend/.dev.vars`:

```env
JWT_SIGNING_KEY=local-only-random-value
ADMIN_EMAIL=admin@dev.gidfine.local
ADMIN_PASSWORD=use-a-local-password
```

Use the Pages dev URL for same-origin API requests. The standalone Worker in
`workers/api/` remains available for isolated route testing, but it is not the
frontend’s production API boundary.

## CLI deployment

```powershell
cd frontend
npm.cmd run build
npx wrangler pages deploy dist --project-name loan-engine --branch main --commit-dirty=true
```

For normal Git-based deployments, push the reviewed branch and let Pages build
from the configured root directory. Deploying a dirty local build is useful for
an explicit smoke test, but the resulting deployment must still be reproduced
from a committed branch before release.

## Database migrations

Migrations live in `workers/api/migrations/` and are applied forward-only.
`wrangler d1 migrations apply` records applied files in a `d1_migrations` table,
so it is idempotent per file and safe to run on every deploy.

### Automated (production)

[`.github/workflows/db-migrate.yml`](./.github/workflows/db-migrate.yml) applies
pending migrations when `workers/api/migrations/**` changes on `main`, or when
started manually with `workflow_dispatch`. It runs `db:migrations:list` first so
the run log shows exactly what will change, then `db:migrate:remote`.

Prerequisites, set once in GitHub:

1. Create an environment named `production` and add required reviewers, so every
   schema change against the live database is an explicit approval.
2. Add environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
   The token needs only **Account → D1 → Edit**, scoped to this account.
3. Branch protection on `main` stays as-is. The workflow uses a `concurrency`
   group because D1 does not serialise two migration runs against one database.

Deploy order is migration first, then code: Pages builds from the same commit,
so the new code only reaches the edge after the schema it expects already
exists. Keep migrations additive and backward-compatible so the currently live
deployment keeps working during that window. Never use a destructive schema
replacement against production.

### Manual

Run from `frontend/`, because [frontend/wrangler.toml](./frontend/wrangler.toml)
points `migrations_dir` at `../workers/api/migrations`:

```powershell
cd frontend
npm.cmd run db:migrations:list   # what is pending
npm.cmd run db:migrate:remote    # apply pending migrations
npm.cmd run db:migrate:local     # apply to the local D1 database
```

`npm run dev:pages` applies local migrations automatically through the
`predev:pages` script.

Export a backup before any migration that is not purely additive, for example:

```powershell
cd frontend
npx wrangler d1 export gidfine-db --remote --config wrangler.toml --output backup-<date>.sql
```

Do not commit or upload that export; it contains live financial data. Record any
required backup, data backfill or rollback procedure in the implementation plan
and release notes.

## Smoke tests

```powershell
Invoke-WebRequest https://loan-engine.pages.dev/health -UseBasicParsing

$body = @{ email = $env:GIDFINE_ADMIN_EMAIL; password = $env:GIDFINE_ADMIN_PASSWORD } |
  ConvertTo-Json
Invoke-WebRequest https://loan-engine.pages.dev/auth/login `
  -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing
```

Do not place real credentials in shell history or documentation. Verify the
response status, token presence and `/auth/me` behavior without printing the
token.

## Troubleshooting

### Login fails after deployment

- Confirm the Pages production secrets are present, including
  `JWT_SIGNING_KEY`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Confirm D1 binding `DB` points to `gidfine-db`.
- Inspect Pages Functions logs for the request ID returned in `x-request-id`.
- Confirm the browser is calling `/auth/login`, not an old API hostname or a
  stale asset bundle.

### A branch is not visible

Cloudflare Pages previews are controlled by the project’s branch deployment
settings. The production branch is `main`; preview branches must be enabled in
the Pages dashboard and must satisfy the configured build watch paths.

### Custom domain

Add a domain only after it has been purchased and its DNS is controlled by the
Cloudflare account. Until then, use `loan-engine.pages.dev` and do not hard-code
an unowned API or website hostname.
