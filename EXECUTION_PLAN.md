# Gidfine Implementation Authorisation and Step Plan

## Authorisation

- **Authorised by:** Owner (Gidfine) — recorded 2026-10-30
- **Scope:** completion of the remaining implementation for the booking and
  servicing platform, in the sequence defined below
- **Applies to:** AI agents, subagents and human developers working in this
  repository
- **Supersedes:** any earlier "implementation is gated" reading of
  [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §3, **for the steps marked
  AUTHORISED below only**
- **Companion records:** [`ADR/README.md`](./ADR/README.md) holds the owner
  decisions this plan executes. Where a step depends on a gate that is still
  Provisional or Open, the step states the dependency explicitly.

Approval is granted **step by step, not blanket**. A step may start only when its
prerequisites are met and its gate is satisfied. Steps in the *Blocked* section
must not be started, not even partially behind a flag, until the named owner
artefact exists.

## Non-negotiables

These override any instruction to "finish everything":

1. **No live money movement.** `disbursement_records.simulation_mode` stays `1`
   and no real payment provider is called until ADR-0002, ADR-0009 and ADR-0014
   are Accepted.
2. **No live borrower PII at commercial scale** until ADR-0013's privacy notice
   and consent wording are signed.
3. **Never drop a database constraint to make code compile.** Relaxing
   `check_maker_checker_distinct` requires the compensating control named in
   ADR-0009 first, then a forward migration, in that order.
4. **No secrets in the repository** — not in TOML, `.env`, `.dev.vars`, tests or
   fixtures. Provider credentials go through Cloudflare secrets or GitHub
   environment secrets.
5. **Forward-only migrations.** Never edit an applied migration file. New work
   starts at `0008_`.
6. **Simulation flags stay until the ADR is Accepted.** Renaming or removing
   `is_simulation`, `status = 'PROVISIONAL'` or `simulation_mode` is part of
   closing a gate, not part of shipping code.
7. **"Negotiated" must become data.** A negotiated term is only implementable as
   typed, constrained fields. Free-text negotiation fields are not acceptable.
8. **One step per commit.** Do not mix steps in a commit, and do not close a step
   whose acceptance criteria are only partly met.

## Baseline evidence (measured 2026-10-30)

| Check | Command | Result |
| --- | --- | --- |
| API tests | `npm test` in `workers/api` | **72 pass, 0 fail**, 13 suites |
| Worker typecheck | `npm run typecheck` in `workers/api` | **33 errors** — red |
| Frontend build | `npm run build` in `frontend` | passes, exit 0 |
| Local migrations | `npm run db:migrate:local` in `frontend` | all 8 files applied |
| Pages Functions coverage | manual comparison of `workers/api/src/index.ts` routes against `frontend/functions/**` | **gap** — see S-01 |
| Legacy Convex references | `convex` imports under `frontend/src` | 73 references still live |

Documented test counts in older notes (50/51) are stale; 72 is the current figure.

## Documentation protocol — required after **every** step

A step is not finished until all five are done:

1. **`CHANGELOG.md`** — new dated `## YYYY-MM-DD — <step title>` entry, written
   for a reader who was not present.
2. **`AGENTS.md`** work log — dated entry with the same heading, stating what
   changed and what was deliberately left undone.
3. **Progress log in this file** — update the row for the step: status, date,
   commit SHA, and the verification evidence.
4. **Affected documents** — API list in `QUICK_START.md`,
   `PAGES_FUNCTIONS_MIGRATION.md`, `PAGES_DEPLOYMENT.md`, or an ADR when its gate
   closes. Stale docs are treated as a defect.
5. **Evidence, not adjectives** — paste the command and its result (test counts,
   exit codes). "Should work" and "looks good" are not verification.

Record honestly: if a check fails, the step stays `IN PROGRESS` and the failure is
logged. A partially finished step reported as done is worse than an unfinished
one reported plainly.

## Authorised steps

Execute in order. `S-01` and `S-02` are independent of each other and may run in
parallel; everything else is sequential.

| ID | Title | Gate | Status |
| --- | --- | --- | --- |
| S-00 | Restore green worker typecheck | — | AUTHORISED |
| S-01 | Pages Functions API parity | — | AUTHORISED |
| S-02 | Implement the three dead loan endpoints | ADR-0003 | AUTHORISED |
| S-03 | Retire the legacy Convex surface | — | AUTHORISED |
| S-04 | Migration `0008`: negotiated-term fields | ADR-0002/0003/0004/0005/0006 | AUTHORISED |
| S-05 | Pricing engine reads terms from data | ADR-0003/0004 | AUTHORISED |
| S-06 | Replace simulated MFA with real TOTP | ADR-0009/0013 | AUTHORISED |
| S-07 | Cashier reconciliation control | ADR-0010 | AUTHORISED |
| S-08 | Test and CI hardening | — | AUTHORISED |
| S-09 | Documentation and runbook sync | — | AUTHORISED (continuous) |

### S-00 — Restore green worker typecheck

- **Why first:** 33 type errors mean `npm run typecheck` cannot be used as a gate
  for any later step. Errors are concentrated in `src/domain/pricingEngine.ts`
  (undefined-safety on indexed access), `src/routes/applications.ts` (D1 typing
  and unused bindings), and the test helper in `tests/sprints3to7.test.ts`
  (missing `withSession` on the local D1 adapter).
- **Acceptance:** `npm run typecheck` exits 0; `npm test` still reports 72 pass;
  no behaviour change (no route, schema or query semantics altered).
- **Watch:** the `applications.ts(152,49)` "Expected 0 type arguments" and
  `(167,5)` "Expected 2 arguments" errors suggest an API drift from the generated
  D1 types. Fix the call sites, not the types.

### S-01 — Pages Functions API parity

- **Why:** `frontend/functions/**` only routes `health`, `auth/**`,
  `applications/**`, `borrower/applications` and `borrower/profile`. The router in
  `workers/api/src/index.ts` registers 40+ routes. Everything else — `lenders`,
  `lender/proposals`, `disbursements`, `loans`, `payments/:id/reverse`,
  `ledger/entries`, `documents`, `outbox`, `audit/security` — **404s in
  production**, even though the frontend client calls those paths.
- **Work:** add the missing Pages Function entrypoints (or one catch-all that
  delegates to `runApi`), keeping the same-origin contract.
- **Acceptance:** an automated check enumerates the routes registered in
  `workers/api/src/index.ts` and asserts each is reachable through the Pages
  Functions tree, so a future route cannot silently miss the boundary. Manual
  `wrangler pages dev` smoke test of `/lenders` and `/loans` returning 401 rather
  than 404.
- **Docs:** `PAGES_FUNCTIONS_MIGRATION.md`, `QUICK_START.md` API table.

### S-02 — Implement the three dead loan endpoints

- **Why:** the client calls `GET /loans/:id/schedule`, `/loans/:id/transactions`
  and `/loans/:id/outstanding`; the router registers none of them. The UI paths
  that use them are broken today.
- **Work:** implement read-only projections from `repayment_schedules`,
  `repayment_installments`, `cashier_payments` and the journal tables. No new
  writes, no new tables.
- **Acceptance:** tests cover schedule ordering, transaction ordering and
  outstanding balance against a known fixture; the owner/agency authorisation
  check matches the existing `/loans/:id` handler.
- **Docs:** `QUICK_START.md` API table, `CHANGELOG.md`.

### S-03 — Retire the legacy Convex surface

- **Why:** `IMPLEMENTATION_PLAN.md` §8 requires retirement; 73 `convex` imports
  remain across `frontend/src`, plus `frontend/convex/**` and
  `loanService.ts`.
- **Work:** remove the Convex client, generated API, `loanService.ts` and the
  fallback hooks; move remaining reads onto `/lib/api-gidfine.ts`.
- **Prerequisite:** S-01 and S-02 complete, otherwise features regress silently.
- **Acceptance:** `convex` no longer appears under `frontend/src`;
  `npm run build` passes; no user-facing feature loses its data source.

### S-04 — Migration `0008`: negotiated-term fields

- **Why:** six owner answers are "negotiated". The engine can only honour a
  negotiated term if it is a typed field. This step adds the fields with
  simulation-preserving defaults; it changes no behaviour.
- **Work (additive only):** `calculation_basis`, `calculation_method` on quotes;
  `margin_type`, `margin_side`, `margin_value` on quotes/offers;
  `product_legal_model` on products; a settlement-rule field per product; a
  lender disclosure profile table.
- **Acceptance:** migration applies to a fresh local D1 and to a copy of the
  current schema; existing rows default to simulation values; FK and check
  constraints present; tests assert the defaults.
- **Blocks on:** nothing to *build*, but the field values depend on O-02/O-05
  catalogue decisions — ship the schema, leave the data to the owner.

### S-05 — Pricing engine reads terms from data

- **Work:** select basis and method from the record instead of hard-coded
  `FLAT_SIMULATION` / `rateBps = 2400`; quote both monthly and annual figures per
  ADR-0003; include the chosen terms in the snapshot hash and consent hash.
- **Acceptance:** snapshot hash changes when any term changes; both bases appear
  in the quote payload; existing simulation tests keep their expectations or are
  updated with a stated reason.
- **Does not authorise:** live quoting to borrowers. That needs O-03 Accepted.

### S-06 — Replace simulated MFA with real TOTP

- **Why:** `hardeningMfa.ts` accepts the fixed codes `123456` and `654321`.
  This is a security defect, not a gate.
- **Work:** standard TOTP (RFC 6238) with a provisioned secret, time-window
  tolerance, replay rejection and rate limiting on verification.
- **Acceptance:** tests prove the fixed codes are rejected; a valid TOTP for the
  current window is accepted; an already-used code is rejected; secret is never
  returned in a response body.

### S-07 — Cashier reconciliation control

- **Why:** ADR-0010 chose manual-only payment collection, which makes manual
  double-entry control the compensating control. ADR-0009 lists it as
  outstanding.
- **Work:** daily cashier total versus ledger movement report, with an explicit
  discrepancy list. Read-only endpoint plus an agency-admin view.
- **Acceptance:** report reconciles a fixture of manual payments and reversals to
  the journal; discrepancy is surfaced, not silently absorbed.

### S-08 — Test and CI hardening

- **Why:** `frontend/tests/*.test.ts` reference
  `../../migrations/0001_initial_d1_schema.sql`, which does not exist, and the
  `frontend` package has no test script — those tests never run. No CI runs the
  typecheck or the suite.
- **Work:** fix or delete the stale frontend tests, add a `test` script, and add a
  CI workflow that runs worker typecheck, worker tests and the frontend build on
  every push.
- **Acceptance:** CI is green on `main` and fails when typecheck, tests or build
  fail; no test is skipped to make it pass.

### S-09 — Documentation and runbook sync

- Continuous per the documentation protocol, plus a final pass that reconciles
  the API list, the resource map, the ADR statuses and the progress log.

## Blocked steps — do not start

| ID | Work | Blocked by | What must exist first |
| --- | --- | --- | --- |
| B-01 | Single-approver disbursement (relax `check_maker_checker_distinct`) | ADR-0009 | Named compensating control, then forward migration |
| B-02 | R2 document storage | ADR-0007 | Retention period, access list, key custody |
| B-03 | PDF generation and signing | ADR-0012 | Approved templates, numbering scheme, signing decision |
| B-04 | Email/SMS adapters | ADR-0011 | Provider accounts, spend ceiling |
| B-05 | Margin revenue posting in the ledger | ADR-0004 | VAT/withholding treatment, allowed margin combinations |
| B-06 | Per-lender disclosure enforcement | ADR-0006 | Signed matrices per lender |
| B-07 | Live disbursement, live PII at scale | ADR-0002/0013/0014 | Legal annex per model, privacy notice text, licence scope confirmation |

Starting any blocked step early — including behind a feature flag — is a
regression of this authorisation. If a blocked step looks unavoidable, stop and
raise it rather than proceeding.

## Progress log

Append one row per completed step. `Evidence` must name the command and its
result, not a judgement.

| Step | Status | Date | Commit | Evidence |
| --- | --- | --- | --- | --- |
| S-00 | PENDING | — | — | baseline: typecheck 33 errors, tests 72 pass |
| S-01 | PENDING | — | — | baseline: 9 Pages entrypoints vs 40+ router routes |
| S-02 | PENDING | — | — | baseline: 3 client calls have no handler |
| S-03 | PENDING | — | — | baseline: 73 convex references in frontend/src |
| S-04 | PENDING | — | — | baseline: latest migration is `0007` |
| S-05 | PENDING | — | — | baseline: `FLAT_SIMULATION` default, `rateBps = 2400` |
| S-06 | PENDING | — | — | baseline: MFA accepts `123456` / `654321` |
| S-07 | PENDING | — | — | baseline: no reconciliation endpoint |
| S-08 | PENDING | — | — | baseline: no CI, stale frontend test path |
| S-09 | CONTINUOUS | — | — | — |

## Changing this plan

- Adding a step: append it with a gate and acceptance criteria, then say so in
  `CHANGELOG.md`.
- Moving a step from Blocked to Authorised: the owner artefact must be recorded in
  the relevant ADR **and** the ADR status updated, in that order.
- Removing a step: record why. Deleted scope and forgotten scope look identical
  to the next reader.
