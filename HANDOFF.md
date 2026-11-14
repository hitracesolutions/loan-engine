# Handoff — staff on-behalf origination (continue + review)

**Written for:** the next agent picking up this repo.
**Date handed off:** 2026-11-14. **Branch:** `development`.
**Repo root:** may have been renamed from `LoanNBFC-main` to `gidfine` (local
folder rename only; not tracked by git, no code references it).

> Read `AGENTS.md` ("Active work — start here"), `DECISION_REVIEW.md`
> ("Process rule" R1–R6) and `ADR/DECISIONS.md` before touching financial code.
> Do not commit — the owner commits their own work and removes all
> Co-Authored-By / attribution lines.

---

## The task

Gidfine agency staff must be able to **register a borrower** and **apply for a
loan on that borrower's behalf**. Backend endpoints are implemented but
unfinished (no tests, no frontend, docs not updated). Your job: finish, verify,
and review.

## Owner decisions already made (do not re-litigate)

1. **Credentials:** staff set a **temporary password** when registering the
   borrower; the borrower can log in immediately and change it.
2. **Consent:** staff must give a **staff-attested consent record** (ADR-0013 is
   Provisional). Interim mechanism = an immutable audit-log event, not a new
   table (avoids a gated migration).
3. **Roles allowed:** `loan_officer` and `agency_admin` only.

## What is already done (backend)

- `workers/api/src/routes/auth.ts` → **`registerBorrowerByStaff`**
  (`POST /staff/borrowers`). Role-guarded (loan_officer/agency_admin), creates a
  `borrower` in the staff member's agency with a staff-set temp password,
  audits `BORROWER_REGISTERED_BY_STAFF` (actor = staff). Returns the borrower;
  **no token issued** (not impersonation — ADR-0015 respected).
- `workers/api/src/routes/applications.ts` → **`createApplicationOnBehalf`**
  (`POST /staff/applications`). Role-guarded; validates `borrowerId` exists as an
  active `borrower` in the agency; **requires** `consent.attested === true` plus a
  `consent.method` in `in_branch|phone|email|written`; creates a `SUBMITTED`
  application with `borrower_id = borrowerId`; writes, in one `db.batch`:
  `APPLICATION_CREATED_ON_BEHALF`, `ON_BEHALF_CONSENT_ATTESTED`, and a status-
  history row — all attributed to the **staff actor**.
- `workers/api/src/index.ts` → both routes registered
  (`.post('/staff/borrowers', …)`, `.post('/staff/applications', …)`).
  `/staff/*` is now a top-level router segment, so `isApiPath` and the Pages
  `_middleware` forward it automatically — **no new `frontend/functions/*` file
  is required** (confirm against `tests/pagesParity.test.ts`).

**State:** two small `requireString(..., { maxLength })` signature fixes were the
last edits and the typecheck was **not** re-run after them. Before: typecheck
exit 0, `npm test` 130/130. **First step: re-verify.**

## Remaining work

1. **Verify green** (see commands below). Fix any fallout from the last edit.
2. **Tests** (`workers/api/tests/`, Node `node:test`, follow the existing
   suites' D1-adapter pattern — cast adapters `as unknown as D1Database`):
   - `POST /staff/borrowers`: 201 for loan_officer/agency_admin; 403 for
     borrower/cashier/underwriter/auditor/lender; 409 on duplicate email;
     borrower created with role `borrower` in the actor's agency; **no token** in
     the response; audit row `BORROWER_REGISTERED_BY_STAFF` written.
   - `POST /staff/applications`: 201 happy path; 403 for disallowed roles;
     404 when `borrowerId` is unknown / not a borrower / other agency;
     400 `CONSENT_REQUIRED` when consent missing or `attested !== true`;
     400 `CONSENT_METHOD_INVALID` for a bad method; application gets
     `borrower_id = borrowerId` and `status = SUBMITTED`; audit rows
     `APPLICATION_CREATED_ON_BEHALF` + `ON_BEHALF_CONSENT_ATTESTED` written with
     actor = staff; the created app appears in the agency queue and in the
     borrower's own `GET /borrower/applications`.
   - An impersonated admin token is rejected by the pre-router guard (these are
     POSTs) — add/confirm a test so ADR-0015 can't regress here.
3. **Frontend** (`frontend/src`, React 19 + Vite + Zustand, api client
   `lib/api-gidfine.ts`): add `gidfineAPI.registerBorrowerByStaff(...)` and
   `gidfineAPI.createApplicationOnBehalf(...)`; add a staff intake screen
   (reachable only for loan_officer/agency_admin) with a borrower-details form +
   a loan-request form + an explicit **consent attestation** checkbox/method
   selector. Keep it simple; Ghana cedis (GH₵), `+233` phone placeholder, no
   India references, no raw "API text" in the UI. `npm run build` must stay green.
4. **Docs** (the owner asked for all docs updated when done):
   - `AGENTS.md` work log — new dated entry.
   - `IMPLEMENTATION_PLAN.md` — add the step (new S-ID) + progress-log row.
   - `CHANGELOG.md` — new entry.
   - `ADR/DECISIONS.md` — record the on-behalf origination decision and note the
     interim audit-log consent mechanism as a dependency of **ADR-0013** (so when
     0013 is Accepted, consent can move to a formal artifact). This is a
     **decision record**, written per the ADR process (supersede, never edit).
5. **Governance review:** confirm nothing here builds Provisional-ADR behaviour
   (0016/0017/0018), relaxes `check_maker_checker_distinct`, flips a simulation
   flag, or routes real money/PII live. On-behalf creation in simulation/pre-
   launch is allowed; **live** borrower PII stays gated by ADR-0013 (C-2) and the
   R6 go-live gate.

## Verify (all must be green)

```bash
cd workers/api && npm run typecheck          # exit 0
cd workers/api && npm test                   # was 130/130; add your new tests
cd frontend   && npm run build               # tsc -b && vite build, exit 0
```

## Guardrails (from AGENTS.md / ADRs)

- Attribute every on-behalf write to the **staff actor**; never issue a borrower
  token to staff and never route this through impersonation (ADR-0015 read-only).
- Keep `agency_id` scoping on every query (ADR-0001).
- Migrations are forward-only, never renamed; next free number is **0009**. The
  consent mechanism here deliberately avoids a migration — keep it that way
  unless the owner accepts ADR-0013 and asks for a consent table.
- Do not commit; leave that to the owner.

## Then: review

After finishing, run a review of the whole change set (`/code-review` on the
branch diff is available) focused on: authz correctness (role + agency scope +
impersonation), consent enforcement, audit completeness, and that the frontend
leaks no PII to borrower-role responses. Report findings; fix or list them.
