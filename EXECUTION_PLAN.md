# Gidfine Implementation Authorisation and Step Plan

## Authorisation

- **Authorised by:** Owner (Gidfine)
- **Recorded:** 2026-10-30 — first as a step-by-step approval, then extended the
  same day to **the complete programme, A to Z**
- **Applies to:** AI agents, subagents and developers working in this repository
- **Scope:** finish every remaining item in this plan. Nothing here needs a
  further engineering decision from the owner; the only things still required
  from the owner or counsel are listed under *Externally gated*.
- **Companion records:** [`ADR/`](./ADR/README.md) (decisions),
  [`BLOCKERS.md`](./BLOCKERS.md) (triage), [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
  (phases and gates), [`Gidfine_Dev_Guide.md`](./Gidfine_Dev_Guide.md) §17
  (requirement traceability).

**What "complete" means:** every step below is `DONE` with evidence, and the
*Release gate* at the end passes. A step is not done because code merged; it is
done when its acceptance check runs green and its documentation is updated.

## Safety floor — what authorisation cannot unlock

Four things are legal or regulatory, not engineering judgement. Approval to build
does not approve shipping these:

1. **Live borrower PII at commercial scale** waits on counsel's privacy notice and
   consent wording (BLOCKERS C-2).
2. **Live disbursement of real money** waits on written confirmation that each
   operating model sits inside the licence held (C-3).
3. **Contract generation for signature** waits on the legal operating-model annex
   (C-4); the renderer may be built and previewed before that.
4. **Per-lender disclosure enablement** waits on that lender's signed matrix
   (C-1); the profile machinery may be built before it.

Building toward these is authorised. Turning them on is not, until the artefact
exists and the matching ADR is `Accepted`.

## Non-negotiables

1. **No live money movement** while `disbursement_records.simulation_mode = 1`
   has not been cleared under the release gate.
2. **No live borrower PII at scale** before C-2.
3. **Never drop a database constraint to make code compile.** Relaxing
   `check_maker_checker_distinct` is a planned step (S-15) with a prerequisite,
   not a shortcut.
4. **No secrets in the repository** — not in TOML, `.env`, `.dev.vars`, tests or
   fixtures.
5. **Forward-only migrations, never renamed.** Next free number is `0008_`; new
   files only. The two `0002_*` files are intentional.
6. **Simulation flags stay until the matching ADR is `Accepted`.**
7. **"Negotiated" must become data** — typed, constrained fields, never free text.
8. **One step per commit**, with the documentation protocol applied.
9. **Authorization is enforced server-side**, never by a frontend guard alone.
10. **No capability published on the landing page or in marketing that the
    platform does not have.**

## Baseline evidence (measured 2026-10-30)

| Check | Command | Result |
| --- | --- | --- |
| API tests | `npm test` in `workers/api` | **81 pass, 0 fail**, 14 suites |
| Worker typecheck | `npm run typecheck` in `workers/api` | **33 errors** — red |
| Frontend build | `npm run build` in `frontend` | passes, exit 0 |
| Local migrations | `npm run db:migrate:local` in `frontend` | all 8 files applied |
| Pages Functions parity | `frontend/functions/**` vs `workers/api/src/index.ts` | gap — S-01 |
| Legacy Convex | `convex` imports under `frontend/src` | 73 references — S-03 |
| CI | `.github/workflows` | migrations only, no test/build gates — S-08 |

## Documentation protocol — after **every** step

1. `CHANGELOG.md` — dated entry a newcomer can follow.
2. `AGENTS.md` work log — same heading, plus what was deliberately left undone.
3. Progress log in this file — status, date, commit, and the command/result.
4. Affected documents — API list, deployment guide, ADR when a gate closes,
   guide §15/§17 when a requirement changes.
5. **Evidence, not adjectives.** Paste the command and its result.

A step whose checks failed stays `IN PROGRESS` with the failure logged. Reporting
a partial step as done is worse than reporting it unfinished.

## The steps

Status: `DONE` · `NEXT` · `AUTHORISED` · `SEQUENCED` (needs an earlier step) ·
`GATED` (needs an external artefact).

| ID | Work | Acceptance | Status |
| --- | --- | --- | --- |
| S-00 | Restore green worker typecheck (33 errors) | `npm run typecheck` exit 0; suite still 81 pass; no behaviour change | NEXT |
| S-01 | Pages Functions route parity for every worker route | automated check enumerates `index.ts` routes and asserts a Pages entrypoint exists; `/lenders`, `/loans` return 401 not 404 | AUTHORISED |
| S-02 | Implement `GET /loans/:id/schedule`, `/transactions`, `/outstanding` | tests cover ordering and outstanding balance from fixtures; owner scoping matches `/loans/:id` | AUTHORISED |
| S-03 | Retire the Convex surface | zero `convex` under `frontend/src`; build passes; no feature loses a data source | SEQUENCED (S-01, S-02) |
| S-04 | Migration `0008`: negotiated-term fields | applies to fresh and current schema; defaults preserve simulation; check constraints present | AUTHORISED |
| S-05 | Pricing reads terms from data; both bases; round half up | changing any term changes the snapshot hash; both bases in payload; fixtures at round-half-up | SEQUENCED (S-04) |
| S-06 | Real TOTP MFA (replace fixed codes) | `123456`/`654321` rejected; valid window accepted; replay rejected; secret never returned | AUTHORISED |
| S-07 | Daily disbursement + cashier reconciliation reports | reconciles fixture payments/reversals to the journal; discrepancies surfaced | AUTHORISED |
| S-08 | CI: typecheck + tests + build; fix stale frontend tests | CI green on main, red on a broken typecheck; no skipped tests | AUTHORISED |
| S-09 | Documentation and runbook sync | continuous; final pass reconciles API list, resource map, ADR statuses | CONTINUOUS |
| S-10 | Administrator impersonation (read-only, audited) | 9 tests green; pages entrypoint added | **DONE** |
| S-11 | Margin revenue posting on collection, multi-component | a payment posts each margin component; a reversal removes it; unpaid instalments post nothing | SEQUENCED (S-05) |
| S-12 | Matching and routing completion (hybrid, eligibility, 48h timeout) | both modes modelled; placeholder proposal generation removed; eligibility respects disclosure profiles | SEQUENCED (S-05) |
| S-13 | Per-lender disclosure profile machinery, fail closed | lender with no profile gets an empty payload; profile filters API **and** documents | AUTHORISED |
| S-14 | Product catalogue validation (bounds, frequency set, no early settlement) | a product with an unset/invalid rule cannot be activated; settlement before maturity is refused | SEQUENCED (S-04) |
| S-15 | Approval model switch: single approver + reconciliation control | reconciliation report proves on fixtures **first**, then forward migration relaxes the constraint; role matrix enforced | SEQUENCED (S-07, S-14) |
| S-16 | Discrepancy escalation surface for reconciliation | an unresolved discrepancy is visible to the auditor role and cannot be silently closed | SEQUENCED (S-07) |
| S-17 | R2 private document storage with 5-year retention | upload/download scoped to staff, auditors, borrower; deletion job at 5 years with audit trail; key custody documented | AUTHORISED (build) |
| S-18 | Document renderer: offer, agreement, schedule, receipts, statements | renders from immutable snapshots; numbering scheme pluggable; same disclosure filtering as APIs | SEQUENCED (S-13, S-17) |
| S-19 | Email + SMS adapters behind an interface | adapter tests green with a fake provider; retry ceiling enforced; per-message cost recorded; **disabled** until providers exist | AUTHORISED (build) |
| S-20 | Frontend completion: lender, cashier and agency portals on real endpoints | each portal handles loading/empty/error/permission-denied; no dead controls; keyboard reachable | SEQUENCED (S-01, S-02) |
| S-21 | Frontend design-token alignment decision | either the landing adopts `--primary`/`--secondary` tokens or the dark theme gains dark-varying tokens; one system, not two | AUTHORISED |
| S-22 | Observability, runbook, backup/restore drill | restore drill from a D1 export recorded in the runbook; structured logs carry request ids, never PII | AUTHORISED |
| S-23 | Security review: cross-role leakage, enumeration, export leakage | findings list with severity; nothing critical open | SEQUENCED (S-13, S-20) |
| S-24 | UAT pack and acceptance evidence | each §14 acceptance criterion has a recorded pass/fail with evidence | SEQUENCED (S-15, S-23) |

### Detail on the steps that carry real risk

**S-00 — typecheck.** Errors cluster in `domain/pricingEngine.ts` (undefined-safety
on indexed access), `routes/applications.ts` (D1 typing drift) and
`tests/sprints3to7.test.ts` (local adapter missing `withSession`). Pin current
behaviour with a characterization test before touching the call sites: the suite
passes 81/81 today, and a typecheck fix must not change behaviour on financial code.

**S-15 — approval model.** Order is fixed: build the reconciliation report (S-07),
prove it on fixtures, then migrate. Relaxing the constraint first leaves a money
path with no detective control. Approval from the owner covers the *model*; it does
not authorise skipping this sequence.

**S-17 — document storage.** Retention (5 years) and readers (staff, auditors,
borrower; never a lender) are decided. The remaining design obligations are
encryption/key custody and the deletion procedure (BLOCKERS R-6). A store without
a deletion path is a permanent PII liability, so both ship with the feature.

**S-19 — notifications.** Build the adapters and the cost accounting now; keep
dispatch disabled until providers and an alert threshold exist (BLOCKERS R-4, R-5).
An enabled adapter with no cost guard is how an outbox retry storm becomes a bill.

## Externally gated — cannot be self-approved

| Item | Owner | Unblocks |
| --- | --- | --- |
| C-1 Per-lender signed disclosure matrices | Counsel | Enabling any lender profile (S-13 machinery is buildable now) |
| C-2 Privacy notice text + consent wording, processing register | Counsel | Live borrower PII (S-17, S-18 shipping to real users) |
| C-3 Licence reference and per-model scope confirmation | Counsel / owner | Live disbursement, commercial launch |
| C-4 Legal operating-model annex, lender as payee | Counsel | Signable contracts from S-18 |
| R-8 Written accountant confirmation (VAT exemption) | Accountant | Invoicing/receipts |

Smaller owner answers still open are listed in [`BLOCKERS.md`](./BLOCKERS.md) §3.1
(R-1 to R-10). None of them blocks starting any step above.

## Release gate — all must be true before real money or real PII

- [ ] S-00, S-01, S-02, S-06, S-08, S-15 complete with evidence
- [ ] S-07 reconciliation proven on fixtures and running daily
- [ ] C-1, C-2, C-3, C-4 recorded as **Accepted** in `ADR/`
- [ ] R-8 accountant confirmation recorded in ADR-0004
- [ ] S-23 security review signed, nothing critical open
- [ ] S-22 backup/restore drill recorded
- [ ] S-24 UAT evidence attached per acceptance criterion
- [ ] Owner sign-off recorded in [`ADR/README.md`](./ADR/README.md)
- [ ] Simulation flags removed only as part of the matching gate closure

## Progress log

| Step | Status | Date | Commit | Evidence |
| --- | --- | --- | --- | --- |
| S-00 | PENDING | — | — | baseline: typecheck 33 errors, tests 81 pass |
| S-01 | PENDING | — | — | baseline: Pages entrypoints cover health/auth/applications/borrower/admin only |
| S-02 | PENDING | — | — | baseline: 3 client calls have no handler |
| S-03 | PENDING | — | — | baseline: 73 convex references in frontend/src |
| S-04 | PENDING | — | — | baseline: latest migration is `0007` |
| S-05 | PENDING | — | — | baseline: `FLAT_SIMULATION` default, `rateBps = 2400` |
| S-06 | PENDING | — | — | baseline: MFA accepts `123456` / `654321` |
| S-07 | PENDING | — | — | baseline: no reconciliation endpoint |
| S-08 | PENDING | — | — | baseline: no CI test/build gate; stale frontend test path |
| S-09 | CONTINUOUS | — | — | — |
| S-10 | DONE | 2026-10-30 | — | `npm test` 81 pass / 0 fail (14 suites); `npm run build` exit 0; 9 new tests; UI not browser-verified |
| S-11 | PENDING | — | — | baseline: waterfall allocates, no margin revenue component |
| S-12 | PENDING | — | — | baseline: auto proposal placeholders in `matchingEngine.ts` |
| S-13 | PENDING | — | — | baseline: single mask shape via `createMaskedBorrowerSummary` |
| S-14 | PENDING | — | — | baseline: no catalogue bounds; no activation gate |
| S-15 | PENDING | — | — | baseline: `check_maker_checker_distinct` enforced |
| S-16 | PENDING | — | — | baseline: no discrepancy surface |
| S-17 | PENDING | — | — | baseline: no `r2_buckets` binding |
| S-18 | PENDING | — | — | baseline: no PDF path |
| S-19 | PENDING | — | — | baseline: simulated delivery adapter |
| S-20 | PENDING | — | — | baseline: portals exist, several call unrouted endpoints |
| S-21 | PENDING | — | — | baseline: landing hardcodes a dark palette beside the token system |
| S-22 | PENDING | — | — | baseline: no restore drill recorded |
| S-23 | PENDING | — | — | baseline: no pentest; disclosure tests only |
| S-24 | PENDING | — | — | baseline: no UAT evidence pack |

## Changing this plan

- Adding a step: append with acceptance criteria, then note it in `CHANGELOG.md`.
- Moving `GATED` → `AUTHORISED`: the artefact must be in the ADR **and** the ADR
  status updated, in that order.
- Removing a step: record why. Deleted scope and forgotten scope look identical
  to the next reader.
