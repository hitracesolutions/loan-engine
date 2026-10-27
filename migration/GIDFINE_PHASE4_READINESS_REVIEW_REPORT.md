# GIDFINE — PHASE 4: FINANCIAL LEDGER AND MAKER-CHECKER DISBURSEMENT

**Repository:** `hitracesolutions/loan-engine`
**Specification:** `Gidfine_Dev_Guide.md` v1.2 (Sections 6, 11 and 12)
**Architecture stack:** Cloudflare Workers → D1 (SQLite) → R2 (receipts)
**Date:** 27 October 2026
**Status:** 📐 Schema and workflow design approved; implementation pending the Worker cutover

> This record replaces the Convex-era Phase 4 readiness report of the same name. The PDFs of the same name in this directory are superseded evidence.

---

## 1. Objective

Provide an auditable money model on D1:

- every movement is a **double-entry journal transaction** (debits = credits),
- history is **append-only**; corrections are **compensating reversals**,
- disbursements require **maker-checker** separation of duties,
- every write is **idempotent**.

---

## 2. Data model

Tables are created by versioned migrations in `workers/api/migrations/`.

### 2.1 Journal core

```sql
CREATE TABLE journal_transactions (
  id                TEXT PRIMARY KEY,
  agency_id         TEXT NOT NULL REFERENCES agencies(id),
  application_id    TEXT REFERENCES loan_applications(id),
  reference         TEXT NOT NULL,              -- human readable: TX-ACC-202610-000456
  idempotency_key   TEXT NOT NULL,
  entry_type        TEXT NOT NULL CHECK (entry_type IN (
                      'DISBURSEMENT_PRINCIPAL',
                      'REPAYMENT_COLLECTION',
                      'FEE_ASSESSMENT',
                      'REVERSAL_COMPENSATION')),
  status            TEXT NOT NULL CHECK (status IN ('RECORDED','SETTLED','REVERSED')),
  maker_id          TEXT NOT NULL REFERENCES users(id),
  checker_id        TEXT REFERENCES users(id),
  external_reference TEXT,
  notes             TEXT,
  effective_date    INTEGER NOT NULL,            -- epoch ms, business date
  posted_at         INTEGER NOT NULL,            -- epoch ms, system time
  CHECK (checker_id IS NULL OR checker_id <> maker_id)
);

CREATE UNIQUE INDEX idx_journal_tx_idempotency
  ON journal_transactions (agency_id, idempotency_key);
CREATE INDEX idx_journal_tx_application ON journal_transactions (application_id);
CREATE INDEX idx_journal_tx_agency_date ON journal_transactions (agency_id, posted_at);

CREATE TABLE journal_lines (
  id             TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES journal_transactions(id),
  agency_id      TEXT NOT NULL,
  account        TEXT NOT NULL CHECK (account IN (
                   'LOAN_RECEIVABLE','CASH','BANK','INTEREST_INCOME',
                   'FEE_INCOME','PENALTY_INCOME','SUSPENSE')),
  direction      TEXT NOT NULL CHECK (direction IN ('DEBIT','CREDIT')),
  amount_pesewas INTEGER NOT NULL CHECK (amount_pesewas > 0),
  currency       TEXT NOT NULL DEFAULT 'GHS',
  created_at     INTEGER NOT NULL
);

CREATE INDEX idx_journal_lines_tx ON journal_lines (transaction_id);
CREATE INDEX idx_journal_lines_agency_account ON journal_lines (agency_id, account);
```

### 2.2 Disbursement (maker-checker)

```sql
CREATE TABLE disbursement_requests (
  id                TEXT PRIMARY KEY,
  agency_id         TEXT NOT NULL,
  application_id    TEXT NOT NULL UNIQUE REFERENCES loan_applications(id),
  amount_pesewas    INTEGER NOT NULL CHECK (amount_pesewas > 0),
  status            TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','POSTED')),
  maker_id          TEXT NOT NULL REFERENCES users(id),
  checker_id        TEXT REFERENCES users(id),
  idempotency_key   TEXT NOT NULL,
  external_reference TEXT,
  requested_at      INTEGER NOT NULL,
  decided_at        INTEGER,
  posted_at         INTEGER,
  CHECK (checker_id IS NULL OR checker_id <> maker_id)
);

CREATE UNIQUE INDEX idx_disbursement_idempotency
  ON disbursement_requests (agency_id, idempotency_key);
```

### 2.3 Repayments

```sql
CREATE TABLE repayment_receipts (
  id             TEXT PRIMARY KEY,
  agency_id      TEXT NOT NULL,
  loan_id        TEXT NOT NULL REFERENCES loans(id),
  amount_pesewas INTEGER NOT NULL CHECK (amount_pesewas > 0),
  channel        TEXT NOT NULL CHECK (channel IN ('CASH','BANK_TRANSFER','MOBILE_MONEY','CARD')),
  external_reference TEXT,
  idempotency_key TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('RECORDED','ALLOCATED','REVERSED')),
  received_at    INTEGER NOT NULL,
  recorded_by    TEXT NOT NULL REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_repayment_idempotency
  ON repayment_receipts (agency_id, idempotency_key);

CREATE TABLE repayment_allocations (
  id                TEXT PRIMARY KEY,
  receipt_id        TEXT NOT NULL REFERENCES repayment_receipts(id),
  installment_id    TEXT NOT NULL REFERENCES repayment_installments(id),
  penalty_pesewas   INTEGER NOT NULL DEFAULT 0 CHECK (penalty_pesewas >= 0),
  interest_pesewas  INTEGER NOT NULL DEFAULT 0 CHECK (interest_pesewas >= 0),
  principal_pesewas INTEGER NOT NULL DEFAULT 0 CHECK (principal_pesewas >= 0),
  created_at        INTEGER NOT NULL
);

CREATE INDEX idx_allocations_receipt ON repayment_allocations (receipt_id);
CREATE INDEX idx_allocations_installment ON repayment_allocations (installment_id);
```

### 2.4 Reversals

```sql
CREATE TABLE reversal_requests (
  id                  TEXT PRIMARY KEY,
  agency_id           TEXT NOT NULL,
  original_transaction_id TEXT NOT NULL REFERENCES journal_transactions(id),
  reason              TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','POSTED')),
  maker_id            TEXT NOT NULL REFERENCES users(id),
  checker_id          TEXT REFERENCES users(id),
  created_at          INTEGER NOT NULL,
  decided_at          INTEGER,
  CHECK (checker_id IS NULL OR checker_id <> maker_id)
);
```

> `ledger_entries` referenced in the Dev Guide is the per-loan read model. It is derived from `journal_lines` by query and **must not** be written independently.

---

## 3. Invariants

| # | Invariant | Enforcement |
| --- | --- | --- |
| L1 | Debits equal credits for every transaction | Computed before insert; verified by the reconciliation query |
| L2 | No `UPDATE` or `DELETE` on posted journal rows | Database permissions + code review; correction is a reversal |
| L3 | Maker ≠ checker | `CHECK` constraint + route guard |
| L4 | One disbursement per application | `UNIQUE (application_id)` |
| L5 | Duplicate idempotency keys never double-post | Unique index + catch-and-return-existing |
| L6 | All amounts are positive integers in pesewas | `CHECK (amount_pesewas > 0)` |
| L7 | Allocations never exceed the receipt | Sum check inside the same `batch()` |
| L8 | Tenant isolation on every statement | `agency_id = ?` from the JWT |

---

## 4. Posting patterns

### 4.1 Disbursement (approved)

```
DEBIT   LOAN_RECEIVABLE   5,000,000 pesewas
CREDIT  CASH/BANK         5,000,000 pesewas
```

### 4.2 Repayment (waterfall: penalty → interest → principal)

```
DEBIT   CASH/BANK         1,008,330
CREDIT  PENALTY_INCOME       12,500
CREDIT  INTEREST_INCOME     210,000
CREDIT  LOAN_RECEIVABLE     785,830
```

Rounding is applied once, at the final line, so the transaction always balances.

### 4.3 Reversal

Create a **new** transaction of type `REVERSAL_COMPENSATION` that mirrors the original with directions swapped, and set `original.status = 'REVERSED'`. The original rows are never modified.

---

## 5. Atomicity on D1

D1 has no interactive transactions across `await`. Use one atomic `batch()` per business operation:

```ts
const statements = [
  env.DB.prepare(
    `INSERT INTO journal_transactions
       (id, agency_id, application_id, reference, idempotency_key, entry_type, status,
        maker_id, checker_id, effective_date, posted_at)
     VALUES (?, ?, ?, ?, ?, 'DISBURSEMENT_PRINCIPAL', 'RECORDED', ?, ?, ?, ?)`
  ).bind(...),
  ...lines.map(l => env.DB.prepare(
    `INSERT INTO journal_lines
       (id, transaction_id, agency_id, account, direction, amount_pesewas, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(...)),
  env.DB.prepare(
    `UPDATE disbursement_requests SET status='POSTED', posted_at=? WHERE id=? AND status='APPROVED'`
  ).bind(now, requestId),
];

await env.DB.batch(statements);
```

If the batch throws a unique-constraint error on the idempotency index, read the existing transaction and return it — never retry blindly.

---

## 6. Reconciliation

Nightly cron (`0 6 * * *`) runs:

```sql
SELECT t.id,
       SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount_pesewas
                ELSE -l.amount_pesewas END) AS imbalance_pesewas
FROM journal_transactions t
JOIN journal_lines l ON l.transaction_id = t.id
WHERE t.posted_at >= ?
GROUP BY t.id
HAVING imbalance_pesewas <> 0;
```

Any non-empty result pages the on-call engineer and blocks further postings for the affected agency until resolved.

---

## 7. Verification

```bash
cd frontend
node --experimental-strip-types --test tests/*.test.ts
```

Ledger-specific checks (once the Worker exists):

- [ ] Every generated transaction balances to zero.
- [ ] Duplicate `Idempotency-Key` yields one row and an identical response body.
- [ ] Maker cannot approve their own disbursement (`CHECK` violation surfaces as `FORBIDDEN`).
- [ ] Two concurrent approvals with the same key produce a single posting.
- [ ] Reversal pair nets to zero and the original is marked `REVERSED`.
- [ ] Allocation rounding leaves no residual pesewa.
- [ ] Cross-tenant ledger reads return nothing.

---

## 8. Open business decisions

These block the final implementation and are carried from Dev Guide Section 15:

1. Interest basis (monthly vs annual; flat vs reducing) and the rounding policy per installment.
2. Whether agency margin is a spread, a fee, or both — and who receives which cash flow.
3. Whether partial prepayment is allowed, and whether penalties apply.
4. Whether reversal of a settled repayment requires dual authorisation or a single supervisor.
5. Retention period for ledger and receipt evidence under Act 843.
