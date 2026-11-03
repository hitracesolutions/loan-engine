# Architecture Decision Records — owner decision gates

One record per owner gate from [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md).
Each records a Gidfine business decision from *open* to *accepted*, with the
version, date and rationale that [Definition of Done item 1](../IMPLEMENTATION_PLAN.md)
and [guide §16 change control](../Gidfine_Dev_Guide.md) require.

This file is the single source of record for all decisions. Each decision is a
section below, linked from the index. The gates do not block code: Sprints 1-7
are implemented, but every financial and third-party path runs in **simulation
mode** until the matching decision is accepted. Read the relevant section before
changing behaviour that depends on it.

For the current triage of what is answered versus still waiting on an owner or
counsel answer, see [`BLOCKERS.md`](../BLOCKERS.md).

## Status vocabulary

| Status | Meaning |
| --- | --- |
| **Open** | No decision recorded. Simulation defaults are in force; do not build live behaviour on them. |
| **Provisional** | A direction is recorded but a required detail is still missing. Code may follow the direction; it must not go live. |
| **Accepted** | Signed decision with version, date and rationale. Live behaviour may be implemented. |
| **Superseded** | Replaced by a later record; keep for history. |

## Index

| ADR | Gate | Decision area | Status | Blocks |
| --- | --- | --- | --- | --- |
| [0001](#adr-0001) | O-01 | Tenancy model | Accepted | Onboarding a second agency |
| [0002](#adr-0002) | O-02 | Legal operating model | Provisional | Contracts, funded disbursement, payee, allocation |
| [0003](#adr-0003) | O-03 | Interest calculation method | Provisional | Live pricing engine, schedule generation |
| [0004](#adr-0004) | O-04 | Agency margin & revenue rules | Provisional | Live quote maths, ledger revenue accounts |
| [0005](#adr-0005) | O-05 | Loan product parameters | Provisional | Product catalogue, schedule generator |
| [0006](#adr-0006) | O-06 | Lender KYC disclosures | Provisional | Legally valid lender-facing payloads |
| [0007](#adr-0007) | O-07 | Document retention policy | Provisional | R2 binding, document upload/download |
| [0008](#adr-0008) | O-08 | Lender matching workflow | Provisional | Proposal routing model |
| [0009](#adr-0009) | O-09 | Maker-checker & approvals | Provisional | Live disbursement authority, MFA hardening |
| [0010](#adr-0010) | O-10 | Payment collection scope | Provisional | Payment webhooks, reconciliation |
| [0011](#adr-0011) | O-11 | Notification channels & budget | Provisional | Real email/SMS delivery |
| [0012](#adr-0012) | O-12 | Generated financial documents | Provisional | PDF generation, digital signing |
| [0013](#adr-0013) | O-13 | Data protection (Act 843) | Provisional | Live borrower PII processing |
| [0014](#adr-0014) | O-14 | Lending & credit licensing | Provisional | Commercial launch, live disbursement |

### Operational decisions

Not owner gates, but decisions with security consequences that future code must
honour.

| ADR | Subject | Status |
| --- | --- | --- |
| [0015](#adr-0015) | Administrator impersonation ("view as") — read-only, audited, revocable | Accepted |

## Open items at a glance

Every task still blocking a decision, in one place. Each ADR's own *Outstanding
before acceptance* list is authoritative; this table is a convenience index and
links each item to its [`BLOCKERS.md`](../BLOCKERS.md) triage ID. Accepted
records (0001, 0015) carry no open items.

| ADR | Status | Still needed before acceptance | Triage |
| --- | --- | --- | --- |
| [0002](#adr-0002) | Provisional | Signed legal operating-model annex naming the lender as payee; contract templates | C-4 |
| [0003](#adr-0003) | Provisional | Allowed methods per product; worked flat/reducing fixtures at round-half-up | R-9 |
| [0004](#adr-0004) | Provisional | Written accountant confirmation of VAT exemption; revenue accounts provisioned | R-8 |
| [0005](#adr-0005) | Provisional | Max late-penalty rate; min/max loan amount; launch product catalogue | R-1 |
| [0006](#adr-0006) | Provisional | Signed per-lender disclosure matrix; default fail-closed profile; field reconciliation | C-1 |
| [0007](#adr-0007) | Provisional | Key-custody/encryption model; deletion & anonymisation procedure at 5 years | R-6 |
| [0008](#adr-0008) | Provisional | Counter-offer rules; eligibility audited against disclosure profiles; "who saw it" audit | R-2 |
| [0009](#adr-0009) | Provisional | Permission matrix; build the daily reconciliation report, **then** migrate to relax `check_maker_checker_distinct`; replace simulated MFA | R-10 |
| [0010](#adr-0010) | Provisional | Written launch sign-off; discrepancy escalation path | R-7 |
| [0011](#adr-0011) | Provisional | Email/SMS providers & account holders; alert threshold; per-message retry ceiling; SMS consent/opt-out; templates | R-4, R-5 |
| [0012](#adr-0012) | Provisional | Approved templates; gap-free numbering scheme; storage decision once 0007 closes | R-3 |
| [0013](#adr-0013) | Provisional | Certificate reference & expiry; privacy notice text/version; consent wording; processing register; DSAR procedure | C-2 |
| [0014](#adr-0014) | Provisional | Licence reference/class/dates; per-model scope confirmation; any interest/fee ceilings; reporting cadence | C-3 |

ADR-0001 is accepted but carries one follow-up: note in the implementation plan
that SaaS onboarding requires a new, superseding ADR.

## Closing a record

1. Obtain the written decision from the owner named in the record.
2. Fill in *Decision*, *Rationale*, *Decided by* and *Accepted* date.
3. Update the status in the index above and in [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md).
4. Only then remove the simulation flags listed under *Evidence in the codebase*.
5. Never rewrite an accepted decision — supersede it with a new record (a new
   section with the next free number), and mark the old one **Superseded**.

---

<a id="adr-0001"></a>
## ADR-0001: Tenancy model

- **Gate:** O-01
- **Status:** Accepted — owner direction recorded 2026-10-30
- **Owner:** Matthias and the Gidfine executive team
- **Decided by:** Owner (recorded 2026-10-30)
- **Version:** 1.0
- **Constrains:** every query that filters by `agency_id`

### Context

The schema is multi-tenant capable: every business table carries `agency_id`
and rows default to the single agency `gidfine`. Until now no commercial policy
existed for onboarding a second, independent agency onto the same deployment —
the only gate whose technical shape was already settled.

### Decision

**Single agency only.** Gidfine operates the platform for itself. No second
independent agency will be onboarded onto this deployment.

### Rationale

Recorded direction: Gidfine is the operator and the customer, so the complexity
of cross-agency provisioning, per-agency billing and cross-agency data isolation
buys nothing.

### Consequences

- No cross-agency isolation suite, agency provisioning flow or per-agency DPA is
  required for launch.
- `agency_id` stays in the schema and in queries. It is now a *defence-in-depth*
  filter and a future migration path, not a multi-tenant contract. Removing it
  would be a large, risky change for no launch benefit, so it stays.
- If a second agency is ever onboarded, this record must be **superseded** —
  not edited — because isolation guarantees would then need to be proven.

### Evidence in the codebase

- `agency_id` on all tables from `workers/api/migrations/0001_core.sql` onward,
  including the compound idempotency key `(agency_id, key)`.
- Staff and lender access scoping already filters by `agency_id`.

### Follow-up

- [ ] Note in `IMPLEMENTATION_PLAN.md` that SaaS onboarding requires a new ADR.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-01
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 1

---

<a id="adr-0002"></a>
## ADR-0002: Legal operating model

- **Gate:** O-02
- **Status:** Provisional — arranger model decided 2026-10-30; signed legal annex outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** none
- **Constrains:** ADR-0003, ADR-0004, ADR-0009, ADR-0010

### Context

The platform can originate, price, approve and disburse, but nothing in the code
establishes *who Gidfine is* in the transaction. That identity decides the
contract counterparty, the source of disbursed funds, the legal payee for
repayments, and who carries allocation liability on partial or disputed
payments. Today all of it is simulated.

### Decision

**Arranger for every product at launch.** Gidfine is an intermediary: contracts
run lender ↔ borrower, Gidfine does not hold funds, and the legal payee for
repayments is the lender.

This **supersedes** the earlier "mixed model, designated per product" direction
(2026-10-30, unversioned draft). The mixed model is deliberately deferred, not
rejected: reintroducing it requires a new ADR that supersedes this one.

### Rationale

Recorded direction (2026-10-30, blocker B-2): one operating model for launch
removes per-product legal annexes, keeps the ledger to commission revenue, and
avoids holding customer funds — which would add trust-account and licensing
obligations that are not needed to start.

### Consequences

- No `product_legal_model` attribute is required at launch. Adding one later is a
  forward migration, not a breaking change.
- The chart of accounts needs commission revenue only; no receivable or trust
  liability account is required yet.
- If a creditor-of-record product is ever launched, this record is superseded and
  the ledger, contracts and licensing scope all change together.

### Outstanding before acceptance

- [ ] Signed legal operating-model document confirming the arranger model,
      naming the lender as payee for repayments.
- [ ] Contract templates naming the lender as counterparty.

### Evidence in the codebase

- `workers/api/src/domain/makerCheckerDisbursement.ts` — channel typed
  `'SIMULATED' | 'BANK_TRANSFER' | 'MOBILE_MONEY'`, writes `simulation_mode = 1`.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` — chart of accounts
  with no payee or ownership semantics.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-02
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 2

---

<a id="adr-0003"></a>
## ADR-0003: Interest calculation method

- **Gate:** O-03
- **Status:** Provisional — direction recorded 2026-10-30, per-product assignment outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** ADR-0002
- **Constrains:** ADR-0004, ADR-0012

### Context

The pricing engine computes quotes under two explicitly labelled simulation
strategies and tags every result `is_simulation = 1`, `status = 'PROVISIONAL'`.
The default nominal rate is hard-coded at 24% p.a. No basis or method has been
agreed with a lender or borrower.

### Decision

1. **Rate basis:** both monthly and annual rates are quoted **side by side** on
   every quote and disclosure, so the borrower sees the same price in either
   unit.
2. **Method:** not fixed globally. Gidfine selects the calculation method during
   negotiation, per deal/product. The engine must therefore support **flat** and
   **reducing balance** side by side, with the chosen method recorded on the
   quote, the offer and the consent evidence.
3. **Rounding:** **round half up to the nearest pesewa.** Applies to both methods
   and to every figure shown to a borrower or lender.

### Rationale

Recorded direction: Gidfine decides the method during negotiation, so the method
is a negotiated term rather than a system-wide setting. Quoting both bases keeps
disclosure comparable and prevents a monthly figure from hiding a higher annual
cost.

### Consequences

- The engine keeps both strategies but they must be *selected*, not merely
  defaulted: quote records need an explicit `calculation_basis` (MONTHLY |
  ANNUAL) and `calculation_method` (FLAT | REDUCING_BALANCE).
- The consent terms hash must include both fields so a borrower's agreed terms
  cannot silently change method later.
- Worked examples are required per (basis × method) combination before live use.

### Outstanding before acceptance

- [ ] Default or allowed set of methods per product (feeds ADR-0005).
- [ ] Worked calculator fixtures for flat and reducing balance at monthly and
      annual basis, using round-half-up.

### Evidence in the codebase

- `workers/api/src/domain/pricingEngine.ts` — `FLAT_SIMULATION`,
  `REDUCING_BALANCE_SIMULATION`; results flagged `isSimulation: true`; canonical
  SHA-256 snapshot hash.
- `workers/api/src/routes/lenders.ts` — defaults to `FLAT_SIMULATION` and
  `rateBps = 2400`.
- `workers/api/src/domain/consentWorkflow.ts` — `rateBps = 2400` default.
- `workers/api/migrations/0004_sprint3_lenders_matching_pricing.sql` — basis
  point check constraint `0 <= bps <= 10000`.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-03
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 3

---

<a id="adr-0004"></a>
## ADR-0004: Agency margin and revenue rules

- **Gate:** O-04
- **Status:** Provisional — direction recorded 2026-10-30, side/type selection per deal outstanding
- **Owner:** Matthias and the Gidfine executive team (with finance)
- **Version:** 0.1
- **Depends on:** ADR-0002, ADR-0003
- **Constrains:** ledger chart of accounts, ADR-0012

### Context

Gidfine must be paid, and the ledger must be able to say how much and from whom.
The chart of accounts built in Sprint 5 has no revenue semantics: no margin
account, no tax treatment, no statement of which party bears the margin.

### Decision

**Mixed margin model.** For any given deal Gidfine may:

- take a share of interest, **or**
- add a percentage (markup) applied on **either** the lender side or the
  borrower side,

charged either as a **flat amount** or as a **percentage**. Which of these
applies is a per-deal/per-product term that Gidfine sets during negotiation.

**Revenue recognition:** margin is recognised **when cash is collected** — not
at disbursement, and not accrued over the loan life.

**Combinations:** **any combination is allowed** on one deal — for example a flat
fee plus an interest share, on the same side or different sides. The ledger must
be able to post more than one revenue component against a single loan.

**Tax treatment:** **exempt** — the margin is treated as consideration for a
financial/credit service, so no VAT line is posted. This is an owner assertion,
not a tax ruling: it must be confirmed in writing by the company accountant
before any invoice or receipt is issued.

### Rationale

Recorded direction: the commercial relationship differs between lenders and
borrowers, so the margin mechanism is negotiated rather than fixed by policy.
The system must express "who pays the margin and in what form" as data, not as
code.

### Consequences

- The quote record needs explicit `margin_type` (FLAT | PERCENTAGE),
  `margin_side` (LENDER | BORROWER), and `margin_value`, all included in the
  terms hash.
- The lender-facing quote and the borrower-facing quote can differ by design;
  each must be reproducible from stored terms, which makes the immutable
  snapshot in ADR-0003 load-bearing.
- Recognition on collection means margin posts only when a payment is allocated,
  so the waterfall in servicing becomes the revenue event. An unpaid or reversed
  instalment must not leave recognised revenue behind, which links this record to
  the reversal rules in ADR-0009.
- Classification depends on the side: a borrower-side markup is agency income,
  while a lender-side spread may be a cost-of-funds or commission treatment.
  That difference is still to be settled with the lender agreements.
- Tax and withholding treatment is still undecided and blocks invoicing/receipts
  (ADR-0012).

### Outstanding before acceptance

- [ ] Written accountant confirmation that the margin is VAT-exempt, recorded
      here before invoicing is built.
- [ ] Revenue accounts provisioned in the chart of accounts.

### Evidence in the codebase

- `workers/api/src/domain/financialLedger.ts` — waterfall allocation
  (Fees → Interest → Principal) and compensating reversals, with no margin rule.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` — `accounts`,
  `journal_entries`, `journal_lines`; no revenue account provisioned.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-04
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 4

---

<a id="adr-0005"></a>
## ADR-0005: Loan product parameters

- **Gate:** O-05
- **Status:** Provisional — direction recorded 2026-10-30, catalogue contents outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** ADR-0003, ADR-0004
- **Constrains:** lender product catalogue, repayment schedule generator

### Context

Lenders configure products, and the schedule generator has to honour whatever
those products allow. With no agreed parameter set, the catalogue can express
combinations the business has not sanctioned.

### Decision

1. **Payment frequencies:** flexible. Any frequency may be configured per
   product in the catalogue; there is no fixed monthly-only assumption.
2. **Grace periods and late penalties:** negotiated per product/deal, not set by
   global policy.
3. **Tenure:** **no cap.** Tenure is configured per product and the validation
   rule must not impose a global maximum.
4. **Early settlement:** **not allowed before maturity.** No rebate or penalty
   formula is implemented; the schedule runs to term.

### Rationale

Recorded direction: terms are commercial and differ by lender and product, so
the system must treat these as configuration rather than business rules
hard-coded in the engine.

### Consequences

- The schedule generator must be frequency-agnostic: weekly, biweekly, monthly and
  bespoke cadences all resolve from product configuration plus a start/value
  date, not from a monthly formula.
- Grace and penalty become nullable product attributes. A schedule with null
  grace/penalty must behave exactly as no grace and no penalty — never as an
  implicit default.
- Because anything is configurable, **validation becomes the control**: the
  catalogue needs bounds (maximum tenure, maximum penalty, minimum amount) or an
  operator can create an unpriceable product.
- Disclosure (ADR-0012) must render whatever the product says, including
  irregular cadences, without assuming monthly.

### Outstanding before acceptance

- [ ] Maximum late-penalty rate and minimum/maximum loan amount (tenure and early
      settlement are decided).
- [ ] Initial product catalogue shared by the lenders launching first.

### Evidence in the codebase

- `workers/api/migrations/0004_sprint3_lenders_matching_pricing.sql` —
  `lender_products`, `product_eligibility_criteria`.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` —
  `repayment_schedules`, `repayment_installments`.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-05
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) items 5 and 6

---

<a id="adr-0006"></a>
## ADR-0006: Lender KYC disclosures

- **Gate:** O-06
- **Status:** Provisional — direction recorded 2026-10-30, per-lender matrices outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Depends on:** ADR-0002, ADR-0013
- **Constrains:** lender proposal feed, notification payloads, generated documents

### Context

Lenders need enough information to price a proposal, but the disclosure boundary
is a legal question, not a product preference. The lender feed already returns a
masked summary — amount, tenure, employment, income band, city and a masked ID
number — constructed through `createMaskedBorrowerSummary`. Nothing establishes
that this is the lawful ceiling.

### Decision

**Per-lender disclosure agreements.** The attributes a lender may see are set by
that lender's agreement with Gidfine, not by a single global ceiling. Each
lender therefore carries its own disclosure profile, and the proposal feed
filters against it.

### Rationale

Recorded direction: lenders differ in what they need and what they are entitled
to, so the boundary must be contractual and configurable per lender rather than
baked into one code path.

### Consequences

- A lender **must not** be able to see a proposal before its disclosure profile
  exists. A missing profile must fail closed, never fall back to full detail.
- The masking helper becomes a policy *enforcer*: it takes the profile and
  removes fields, rather than hard-coding one mask shape.
- Notification payloads and generated documents (ADR-0012) must apply the same
  profile. A masked API response with an unmasked PDF or SMS is a breach.
- Auditors need to see which profile was in force when a proposal was issued.

### Outstanding before acceptance

- [ ] Signed disclosure matrix per lender (attribute list, legal basis).
- [ ] Default profile for a new lender, and the fail-closed behaviour confirmed.
- [ ] Field list reconciliation with `createMaskedBorrowerSummary` — does the
      current mask over- or under-disclose for any lender?

### Evidence in the codebase

- `workers/api/src/routes/lenders.ts` — masked proposal feed using
  `createMaskedBorrowerSummary`, including `id_number_masked`.
- `workers/api/migrations/0003_security_remediation.sql` — National ID stored
  AES-256-GCM encrypted with no plaintext column.
- `workers/api/src/domain/documentsAndOutbox.ts` — outbound payload construction
  where the same profile must apply.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-06
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 7

---

<a id="adr-0007"></a>
## ADR-0007: Document retention policy

- **Gate:** O-07
- **Status:** Provisional — retention and reader access decided 2026-10-30; key custody and deletion procedure outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Depends on:** ADR-0013, ADR-0014
- **Constrains:** R2 binding, document upload/download, deletion/anonymisation

### Context

`document_records` stores metadata and a SHA-256 integrity hash, but **no file
store is bound**: there is no R2 bucket in either wrangler configuration, so no
document has ever been uploaded or served. KYC documents are personal data, so
retention must be defined before any file is stored — not after.

### Decision

**Retention: 5 years after the loan closes.** Then the record and its documents
are deleted or anonymised under the procedure below.

**Access:** an uploaded KYC document may be opened by **agency staff** (per their
existing role permissions), **auditors**, and **the borrower themselves**. A
lender may never open a KYC document; lenders receive only the masked summary
defined in ADR-0006.

### Rationale

Recorded direction: the retention horizon is a regulatory question, not a
commercial preference, so it should follow whichever regime applies to the
licensed operating model.

### Consequences

- R2 cannot be bound until the period, the access list and the encryption story
  are agreed. Documents stay metadata-only, which means **KYC upload is not
  functional at launch** unless this record closes first.
- Deletion must be designed as retention-expiry with an audit trail, never as an
  ad-hoc delete, because financial record-keeping obligations may outlast the
  original purpose.
- Encrypted-at-rest storage needs key custody defined: who can read a document,
  and can the platform operator read it?

### Outstanding before acceptance

- [ ] Encryption/key custody model for stored objects (who can decrypt, and can
      the operator read the file).
- [ ] Deletion and anonymisation procedure executed at the 5-year mark, with
      audit trail.

### Evidence in the codebase

- `workers/api/src/domain/documentsAndOutbox.ts` — metadata plus SHA-256
  integrity hash; no object storage call.
- `workers/api/migrations/0007_sprint6_sprint7_docs_outbox_hardening.sql` —
  `document_records`.
- `frontend/wrangler.toml` and `workers/api/wrangler.jsonc` — no `r2_buckets`
  binding in either.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-07
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 8

---

<a id="adr-0008"></a>
## ADR-0008: Lender matching workflow

- **Gate:** O-08
- **Status:** Provisional — direction recorded 2026-10-30, routing rules outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Constrains:** proposal state machine, lender portal queues

### Context

An application has to reach lenders somehow. The matching engine currently
computes matches and **auto-generates proposal placeholders**, which is a
convenience for testing, not a routing policy.

### Decision

**Hybrid routing.** An application may run as a competitive 1-to-many round and
then fall back to sequential 1-to-1 routing. Which mode applies is a per-case
decision by the agency, not a global setting.

**Blast radius:** in competitive mode, **every eligible lender** may see the
application. Eligibility filtering is therefore the privacy control, not a cap on
lender count.

**Round timeout:** 48 hours by default, configurable per product. The agency
triggers the sequential fallback.

### Rationale

Recorded direction: competitive matching where speed and price discovery matter,
sequential where confidentiality or lender relationships matter. Both must be
available on the same application.

### Consequences

- The proposal state machine must model both modes, including the transition
  from a closed competitive round to a sequential fallback.
- Lender portal queues must distinguish "invited to bid" from "assigned to
  underwrite", or a lender will see the same application twice with different
  meaning.
- The placeholder auto-generation in the matching engine must not survive into
  live routing.

### Outstanding before acceptance

- [ ] Whether lenders may counter-offer, and who approves a counter.
- [ ] Eligibility rules audited against the disclosure profile (ADR-0006): "all
      eligible lenders" must never mean "all lenders".
- [ ] Audit requirement: record who saw the application and when.

### Evidence in the codebase

- `workers/api/src/domain/matchingEngine.ts` — eligibility matching and automatic
  proposal placeholder generation.
- `workers/api/migrations/0004_sprint3_lenders_matching_pricing.sql` —
  `matching_runs`, `lender_proposals`, `proposal_versions`.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-08
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 9

---

<a id="adr-0009"></a>
## ADR-0009: Maker-checker and approvals

- **Gate:** O-09
- **Status:** Provisional — direction recorded 2026-10-30, and it **conflicts with shipped schema**
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** ADR-0002
- **Constrains:** disbursement endpoints, payment reversal, MFA

### Context

Sprint 4 shipped strict Maker-Checker dual control: the database enforces
`checker_id != maker_id` and the API returns 403 when one user attempts both
roles. Sprint 5 shipped payment reversals as append-only compensating entries.
Nothing yet states who is *allowed* to hold these roles, or how many people a
single action requires.

### Decision

1. **Disbursement:** a **single authorised approver is sufficient.** Dual
   authorisation is not required. The approver is either `agency_admin` or
   `loan_officer` — no new role is introduced.
2. **Payment reversal:** a cashier may not reverse alone. A cashier-initiated
   reversal requires **supervisor approval**, while an **admin** may reverse
   directly.
3. **Compensating control:** with dual control removed, a **daily supervisor
   reconciliation report over disbursements** is mandatory. It is the only
   detective control left on that money movement, so it is part of this decision,
   not an optional extra.

### Rationale

Recorded direction: disbursement volume and staffing make dual control
impractical on every loan, so authority is concentrated in a named approver
role. Reversals keep a second pair of eyes because they are the classic
misappropriation path: a payment recorded then reversed moves money without a
matching cash receipt.

### Consequence that must not be missed

**This decision contradicts the schema already deployed.** `0005` carries:

```sql
CONSTRAINT check_maker_checker_distinct CHECK (checker_id IS NULL OR checker_id != maker_id)
```

and the API returns 403 when maker and checker are the same user. Single-approver
disbursement therefore **cannot work until a forward migration relaxes or drops
that constraint**. Until that migration exists, dual control remains the
enforced behaviour and the owner decision is not in force. That is deliberate:
the record leads, the migration follows, and no constraint is dropped silently.

Removing dual control also removes the compensating control against fat-finger
and fraud alike, so the replacement control must be named before the constraint
is dropped — for example a mandatory second-person reconciliation report, or a
per-day disbursement ceiling per approver.

### Outstanding before acceptance

- [ ] Named approver role(s) and the permission matrix (who may override a rate,
      who may record a payment).
- [ ] Build the daily disbursement reconciliation report before the constraint is
      relaxed — it is the named compensating control.
- [ ] Exact role names mapped to the code's role enum.
- [ ] Forward migration to relax the maker/checker constraint.
- [ ] **Replace the simulated MFA** — `hardeningMfa.ts` currently accepts the
      fixed codes `123456` and `654321` for privileged users. That must never
      reach production, and the disbursement decision above assumes real MFA.

### Evidence in the codebase

- `workers/api/migrations/0005_sprint4_consent_disbursement.sql` — maker/checker
  columns and the distinctness constraint.
- `workers/api/src/domain/makerCheckerDisbursement.ts` — dual-control
  enforcement and simulated disbursement adapter.
- `workers/api/src/domain/hardeningMfa.ts` — simulated TOTP acceptance.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` — `cashier_payments`,
  `payment_reversals`.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-09
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 10

---

<a id="adr-0010"></a>
## ADR-0010: Payment collection scope

- **Gate:** O-10
- **Status:** Provisional — MVP scope recorded 2026-10-30
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Depends on:** ADR-0002
- **Constrains:** servicing routes, reconciliation jobs

### Context

The servicing layer accepts `CASH`, `SIMULATED_MOMO` and `SIMULATED_BANK`
payment methods. Nothing reaches a real payment provider, and no webhook or
reconciliation job exists.

### Decision

**Manual cashier entry only for MVP.** No Mobile Money, bank or card
integration at launch. Payments are recorded by an authorised cashier against a
loan, with compensating reversals for corrections. `SIMULATED_MOMO` and
`SIMULATED_BANK` are test-only values and must not be reachable in production
paths.

**Reconciliation:** the **cashier supervisor reconciles every business day** —
daily cashier total against ledger movement, with discrepancies surfaced
explicitly rather than absorbed.

### Rationale

Recorded direction: launch without provider integration. It removes provider
contracting, webhook security and reconciliation design from the launch
critical path, at the cost of manual operational effort and a human
double-entry control on every payment.

### Consequences

- No payment webhook endpoint, no provider credentials, no automated
  reconciliation.
- Cashier authority becomes a security-critical role, which sharpens ADR-0009
  (who may record and reverse a payment).
- Manual entry makes duplicate-payment prevention depend on the existing
  idempotency key mechanism, so that path needs explicit testing.
- Future provider integration is additive: webhooks would post through the same
  journal entry path as manual entry.

### Outstanding before acceptance

- [ ] Written confirmation that manual-only scope is acceptable for launch.
- [ ] Escalation path when the daily total does not match the ledger — the cadence
      and owner are decided (daily, cashier supervisor); the dispute procedure is
      not.

### Evidence in the codebase

- `workers/api/src/domain/financialLedger.ts` — payment methods
  `'CASH' | 'SIMULATED_MOMO' | 'SIMULATED_BANK'`.
- `workers/api/src/routes/servicing.ts` — payment method input typing.
- `workers/api/migrations/0006_sprint5_servicing_ledger.sql` —
  `cashier_payments`, `payment_reversals`.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-10
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 11

---

<a id="adr-0011"></a>
## ADR-0011: Notification channels and budget

- **Gate:** O-11
- **Status:** Provisional — channel set 2026-10-30 (in-app + email + SMS, Gidfine-funded); providers outstanding
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 0.1
- **Constrains:** outbox dispatch worker, credentials, ADR-0013

### Context

The transactional outbox exists and dispatches, but the delivery adapter is a
**simulation**: nothing is ever sent. Email and SMS need provider accounts,
credentials, sender identity and a budget owner, and SMS in particular needs a
consent basis and message templates that never leak lender-hidden data.

### Decision

**In-app + email + SMS.** WhatsApp is out of scope for now.

**Cost:** Gidfine absorbs the per-message cost. It is not charged back to the
lender or the borrower at launch.

**Budget control:** there is **no hard spend cap**. Instead, send volume is
monitored and the owner is alerted when daily or monthly spend looks abnormal.
Guardrails live in the outbox dispatch (per-message cost accounting and a retry
ceiling), not in a blocking limit.

### Rationale

Recorded direction: borrowers in the target market are reachable by SMS, while
email carries the document-grade correspondence. In-app remains the source of
truth for state; email and SMS are notifications about it.

### Consequences

- Two real adapters are needed (email provider, SMS provider) plus credential
  provisioning, retry/backoff behaviour and delivery-status tracking.
- Cost sits with Gidfine, so a monthly ceiling and an alerting threshold are
  needed before volume grows; without them an outbox retry storm becomes an
  unbudgeted SMS bill.
- Template review becomes a compliance task: no hidden borrower data, no rate
  disclosure that contradicts ADR-0003/ADR-0004 terms.
- Consent for SMS must be captured and stored, which links this record to
  ADR-0013.

### Outstanding before acceptance

- [ ] Provider selection for email and SMS, and who holds the accounts.
- [ ] Alerting threshold and notification route, set once provider pricing is
      known (no hard cap was chosen, so detection is the control).
- [ ] A retry ceiling per message, so a failing provider cannot multiply spend.
- [ ] SMS consent capture and opt-out handling.
- [ ] Message template set (none exist yet).

### Evidence in the codebase

- `workers/api/src/domain/documentsAndOutbox.ts` — simulated delivery adapter;
  `outbox_events` dispatch.
- `workers/api/src/routes/documentsAndOutbox.ts` — outbox status tracking and
  batch dispatch.
- `workers/api/migrations/0007_sprint6_sprint7_docs_outbox_hardening.sql` —
  `outbox_events`.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-11
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 12

---

<a id="adr-0012"></a>
## ADR-0012: Generated financial documents

- **Gate:** O-12
- **Status:** Provisional — scope recorded 2026-10-30, templates outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Depends on:** ADR-0003, ADR-0004, ADR-0007, ADR-0013
- **Constrains:** PDF generation, R2 usage, notification attachments

### Context

No document is generated anywhere in the platform today: there is no PDF path,
no template engine, and no object store bound. Records are structured data only.

### Decision

**Full document set at launch**, comprising at minimum:

1. loan offer / terms disclosure,
2. credit agreement,
3. repayment schedule,
4. payment receipts,
5. account statements.

**Signature:** an **audited click-to-accept plus the existing SHA-256 terms
hash** is sufficient acceptance evidence. Where a wet signature is used, the
platform records that it happened and stores the signed copy; it does not
depend on it.

### Rationale

Recorded direction: a lending product without a signed agreement and a schedule
the borrower can hold is not defensible in a dispute, and Act 843 obligations
(ADR-0013) are easier to evidence with issued documents than with database rows.

### Consequences

- A renderer is required. It must read **stored** terms (the immutable quote and
  consent snapshots) rather than recomputing, so a reissued document matches what
  the borrower agreed to.
- Documents must honour the lender disclosure profile (ADR-0006): the same field
  filtering applies to generated artefacts, not just API responses.
- Storage depends on ADR-0007. Until R2 is bound, documents can be generated and
  streamed but not retained, which most likely fails the retention requirement.
- Receipts and statements are derivative artefacts of ledger entries, so they
  must be regenerable from the ledger rather than stored as the source of truth.

### Outstanding before acceptance

- [ ] Approved templates for each document type.
- [ ] Numbering scheme for agreements and receipts (auditable, gap-free).
- [ ] Which documents must also be emailed or SMS-notified (ADR-0011), and
      whether attachments are permitted.
- [ ] Storage decision once ADR-0007 sets the retention rule.

### Evidence in the codebase

- `workers/api/migrations/0007_sprint6_sprint7_docs_outbox_hardening.sql` —
  `document_records` metadata with SHA-256 integrity hash.
- `workers/api/src/domain/pricingEngine.ts` — immutable quote snapshot the
  schedule document must render from.
- `workers/api/src/domain/consentWorkflow.ts` — consent terms hash that a
  generated agreement must match.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-12
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 13

---

<a id="adr-0013"></a>
## ADR-0013: Data protection compliance (Act 843)

- **Gate:** O-13
- **Status:** Provisional — DPC registration confirmed 2026-10-30, written sign-off on consent and privacy text outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Constrains:** any processing of live borrower PII, notification consent, document retention

### Context

The platform captures borrower identity, income, employer and National ID, and
encrypts the ID at rest with AES-256-GCM. Consent is recorded with an immutable
SHA-256 hash of the agreed terms. What is missing is the legal instrument: the
registration status and the approved privacy wording that makes that capture
lawful under the Ghana Data Protection Act, 2012 (Act 843).

### Decision

**Registered with the Data Protection Commission — certificate held.**

Registration is necessary but not sufficient: consent wording, the privacy
notice shown to borrowers, and the record of processing activities must also be
signed off before live PII is processed at commercial scale.

### Rationale

Recorded direction: Gidfine is a registered data controller, which resolves the
licensing question the gate was originally raised for.

### Consequences

- Live borrower PII processing is no longer blocked on registration. It remains
  blocked on the approved privacy notice and consent text.
- The consent record must be able to evidence *which* privacy wording a borrower
  accepted, which means the notice version belongs in the terms hash.
- Data-subject rights (access, correction, deletion) need an operational route.
  Deletion must reconcile with financial retention (ADR-0007), so the answer is
  usually anonymisation rather than erasure.
- SMS and email consent (ADR-0011) falls under the same instrument and needs the
  same evidencing.

### Outstanding before acceptance

- [ ] Certificate reference and expiry recorded, with a renewal owner.
- [ ] Approved privacy notice text and version.
- [ ] Consent wording signed off, and the notice version added to the terms hash.
- [ ] Record of processing activities (what data, why, who can see it, how long).
- [ ] Data-subject request procedure and the anonymisation path for closed loans.

### Evidence in the codebase

- `workers/api/migrations/0003_security_remediation.sql` — AES-256-GCM encrypted
  National ID columns with ciphertext, IV, tag and version; no plaintext.
- `workers/api/src/domain/consentWorkflow.ts` — immutable SHA-256 consent terms
  hash (`CONSENT_ALGORITHM_VERSION`, `sha256-v1`).
- `workers/api/src/routes/lenders.ts` — masked disclosure path that must keep
  matching the approved notice.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-13
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 14

---

<a id="adr-0014"></a>
## ADR-0014: Lending and credit regulatory licensing

- **Gate:** O-14
- **Status:** Provisional — licence held per owner 2026-10-30, reference and per-model scope outstanding
- **Owner:** Matthias and the Gidfine executive team (with legal counsel)
- **Version:** 0.1
- **Depends on:** ADR-0002
- **Constrains:** commercial launch, live disbursement

### Context

This gate blocks the point where the platform stops being a simulation and
starts moving real money for real borrowers. It was raised because the operating
model — and therefore the required authorisation — was undefined.

### Decision

**Gidfine holds a licence for credit intermediation / moneylending.**

### Rationale

Recorded direction: the company is authorised to operate as a credit
intermediary and to lend, which satisfies the regulatory question for the
arranger and creditor models.

### Consequences

- Each operating model designated under ADR-0002 must sit **within** the scope of
  the licence held. Where a product line would need an authorisation Gidfine does
  not hold, that product must not be launched, regardless of code readiness.
- Licence conditions (capital, disclosure, interest ceilings, reporting) become
  product constraints. Any regulatory interest cap overrides ADR-0003 pricing for
  affected products.
- Periodic regulatory reporting becomes an operational obligation, which the
  reporting endpoints must eventually serve.

### Outstanding before acceptance

- [ ] Licence reference, class, issue date and expiry, recorded in the repo.
- [ ] Written confirmation that the licensed scope covers **each** operating
      model designated under ADR-0002, including the creditor-of-record model.
- [ ] Any interest, fee or disclosure ceilings imposed by the licence, and where
      they are enforced in code.
- [ ] Reporting obligations and their cadence.

### Evidence in the codebase

- `workers/api/src/domain/makerCheckerDisbursement.ts` — simulated disbursement
  adapter, the boundary that goes live when this record closes.
- `workers/api/migrations/0005_sprint4_consent_disbursement.sql` —
  `disbursement_records` with `simulation_mode`.

### References

- [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md) — O-14
- [`Gidfine_Dev_Guide.md` §15](../Gidfine_Dev_Guide.md) item 14

---

<a id="adr-0015"></a>
## ADR-0015: Administrator impersonation ("view as")

- **Gate:** none — operational security decision, not an owner gate
- **Status:** Accepted — implemented 2026-10-30
- **Owner:** Matthias and the Gidfine executive team
- **Version:** 1.0
- **Constrains:** every route, through the request guard

### Context

Support and operations need to see the platform as a specific user to diagnose a
problem. On a lending platform that ability is also the shortest path to
fraud: a session that can act as a borrower could accept an offer, sign a
consent, or move money, and a session that can act as a cashier could record a
payment.

The feature was requested for administrator use. This record fixes the
boundaries it is built to, so the next change to it is a decision rather than a
convenience.

### Decision

Administrators (`agency_admin`) may start a short-lived, **read-only** session as
another non-administrator account in the same agency.

1. **Read-only.** The request guard rejects every `POST`/`PUT`/`PATCH`/`DELETE`
   from an impersonated token except `POST /admin/impersonate/stop`. A borrow
   consent, an offer acceptance, a disbursement, a payment or a reversal can
   therefore never be performed while impersonating.
2. **No privilege escalation.** Only `agency_admin` may start a session, an
   impersonated session cannot start another, self-impersonation is rejected,
   and administrators cannot impersonate other administrators.
3. **Same agency, active accounts only.**
4. **Short lived.** 15 minutes, independent of the normal access-token TTL.
5. **Revocable.** Stopping a session writes an audit event, and the guard rejects
   the still-valid token afterwards.
6. **Audited.** `IMPERSONATION_STARTED` and `IMPERSONATION_STOPPED` are written to
   `security_audit_logs` with the administrator, the target, the session id, IP
   and user agent.

### Rationale

Read-only is the only default that is defensible for a financial system. It keeps
the diagnostic value of "seeing what the user sees" while removing the ability to
create legally binding evidence (consent), change money, or approve anything.

### Consequences

- Support cannot fix data by acting as the user; they must use a dedicated
  administrative endpoint that the user's own role could not call. This is
  intentional friction.
- Consent records can never be produced by impersonation, which keeps consent
  evidence defensible under ADR-0013.
- Any future "write while impersonating" request must supersede this record with a
  named compensating control, not extend the allowlist silently.

### Evidence in the codebase

- `workers/api/src/lib/impersonationGuard.ts` — guard that runs before the router,
  so a new route cannot forget the rule.
- `workers/api/src/domain/impersonation.ts` — target validation, audit events,
  revocation lookup.
- `workers/api/src/routes/impersonation.ts` — the three endpoints.
- `workers/api/tests/impersonation.test.ts` — nine tests covering the token
  claims, read-only enforcement, privilege rules and revocation.
- `frontend/src/components/ImpersonationPanel.tsx` and
  `ImpersonationBanner.tsx` — admin control and the persistent read-only banner.

### References

- [`IMPLEMENTATION_PLAN.md` §9](../IMPLEMENTATION_PLAN.md) — quality gates
- [`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md) — step S-10
