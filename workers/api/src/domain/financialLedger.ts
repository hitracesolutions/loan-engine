/**
 * Double-Entry Financial Ledger & Loan Servicing Engine.
 *
 * Implements Sprint 5 financial accounting standards:
 * - Deterministic double-entry ledger with strict sum(debit) == sum(credit) balanced constraint.
 * - Append-only financial records with idempotent posting.
 * - Waterfall payment allocation: Fees -> Interest -> Principal.
 * - Compensating reversal transactions (posted records are never silently modified or deleted).
 */

import { ulid } from '../lib/ids.ts';

export interface JournalLineInput {
  accountCode: string;
  debitPesewas: number;
  creditPesewas: number;
  memo?: string;
}

export interface PostJournalParams {
  db: D1Database;
  agencyId: string;
  actorId: string;
  description: string;
  reference: string;
  lines: JournalLineInput[];
}

export async function postJournalEntry(params: PostJournalParams): Promise<{
  journalEntryId: string;
  entryNumber: number;
  totalPesewas: number;
}> {
  const { db, agencyId, actorId, description, reference, lines } = params;

  if (!lines || lines.length === 0) {
    throw new RangeError('Journal entry must have at least one line');
  }

  // 1. Verify balanced entry constraint
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    if (line.debitPesewas < 0 || !Number.isSafeInteger(line.debitPesewas)) {
      throw new RangeError(`Invalid debit amount: ${line.debitPesewas}`);
    }
    if (line.creditPesewas < 0 || !Number.isSafeInteger(line.creditPesewas)) {
      throw new RangeError(`Invalid credit amount: ${line.creditPesewas}`);
    }
    if (line.debitPesewas > 0 && line.creditPesewas > 0) {
      throw new RangeError('A journal line cannot contain both debit and credit amounts');
    }
    totalDebit += line.debitPesewas;
    totalCredit += line.creditPesewas;
  }

  if (totalDebit !== totalCredit || totalDebit === 0) {
    throw new Error(`UNBALANCED_JOURNAL_ENTRY: Debit (${totalDebit}) does not equal Credit (${totalCredit})`);
  }

  // 2. Next sequential entry number
  const lastEntry = await db
    .prepare(`SELECT coalesce(max(entry_number), 0) as max_num FROM journal_entries WHERE agency_id = ?`)
    .bind(agencyId)
    .first<{ max_num: number }>();

  const entryNumber = (lastEntry?.max_num ?? 0) + 1;
  const journalEntryId = ulid();
  const now = Date.now();

  // 3. Insert Journal Entry
  await db
    .prepare(
      `INSERT INTO journal_entries (id, agency_id, entry_number, entry_date, description, reference, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?, ?)`,
    )
    .bind(journalEntryId, agencyId, entryNumber, now, description, reference, actorId, now)
    .run();

  // 4. Resolve account IDs and insert lines
  for (const line of lines) {
    const account = await db
      .prepare(`SELECT id FROM accounts WHERE agency_id = ? AND code = ?`)
      .bind(agencyId, line.accountCode)
      .first<{ id: string }>();

    if (!account) {
      throw new Error(`ACCOUNT_NOT_FOUND: Code ${line.accountCode} in agency ${agencyId}`);
    }

    await db
      .prepare(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit_pesewas, credit_pesewas, memo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        ulid(),
        journalEntryId,
        account.id,
        line.debitPesewas,
        line.creditPesewas,
        line.memo ?? null,
        now,
      )
      .run();
  }

  return {
    journalEntryId,
    entryNumber,
    totalPesewas: totalDebit,
  };
}

export interface RecordPaymentParams {
  db: D1Database;
  agencyId: string;
  loanId: string;
  cashierId: string;
  amountPesewas: number;
  paymentMethod: 'CASH' | 'SIMULATED_MOMO' | 'SIMULATED_BANK';
  reference: string;
}

export async function processCashierPayment(params: RecordPaymentParams) {
  const { db, agencyId, loanId, cashierId, amountPesewas, paymentMethod, reference } = params;

  if (amountPesewas <= 0 || !Number.isSafeInteger(amountPesewas)) {
    throw new RangeError('Payment amount must be a positive integer in pesewas');
  }

  // Idempotency guard: prevent duplicate payment execution for the same reference
  const existingPayment = await db
    .prepare(`SELECT id FROM cashier_payments WHERE agency_id = ? AND reference = ?`)
    .bind(agencyId, reference)
    .first<{ id: string }>();

  if (existingPayment) {
    throw new Error(`DUPLICATE_PAYMENT_REFERENCE: Payment with reference ${reference} has already been processed`);
  }

  // 1. Fetch loan
  const loan = await db
    .prepare(
      `SELECT id, agency_id, application_id, outstanding_principal_pesewas,
              outstanding_interest_pesewas, outstanding_fees_pesewas, status
       FROM loans
       WHERE id = ? AND agency_id = ?`,
    )
    .bind(loanId, agencyId)
    .first<{
      id: string;
      agency_id: string;
      application_id: string;
      outstanding_principal_pesewas: number;
      outstanding_interest_pesewas: number;
      outstanding_fees_pesewas: number;
      status: string;
    }>();

  if (!loan) {
    throw new Error('LOAN_NOT_FOUND');
  }

  if (loan.status === 'PAID_OFF' || loan.status === 'CLOSED') {
    throw new Error(`LOAN_INACTIVE: Cannot record payment for loan in ${loan.status} status`);
  }

  // 2. Waterfall Allocation: Fees -> Interest -> Principal
  let remainingPayment = amountPesewas;

  const allocatedFees = Math.min(remainingPayment, loan.outstanding_fees_pesewas);
  remainingPayment -= allocatedFees;

  const allocatedInterest = Math.min(remainingPayment, loan.outstanding_interest_pesewas);
  remainingPayment -= allocatedInterest;

  const allocatedPrincipal = Math.min(remainingPayment, loan.outstanding_principal_pesewas);
  remainingPayment -= allocatedPrincipal;

  const now = Date.now();

  // 3. Post Balanced Double-Entry Journal
  // Debit Cash Clearing (Asset increases)
  // Credit Fees, Interest, Principal accounts
  const journalLines: JournalLineInput[] = [
    {
      accountCode: '1010', // Cash Clearing (Debit)
      debitPesewas: amountPesewas,
      creditPesewas: 0,
      memo: `Cashier payment received for loan ${loanId}`,
    },
  ];

  if (allocatedPrincipal > 0) {
    journalLines.push({
      accountCode: '1200', // Loans Receivable (Principal Credit)
      debitPesewas: 0,
      creditPesewas: allocatedPrincipal,
      memo: 'Principal reduction',
    });
  }
  if (allocatedInterest > 0) {
    journalLines.push({
      accountCode: '1210', // Interest Receivable / Income (Credit)
      debitPesewas: 0,
      creditPesewas: allocatedInterest,
      memo: 'Interest payment',
    });
  }
  if (allocatedFees > 0) {
    journalLines.push({
      accountCode: '1220', // Fees Receivable (Credit)
      debitPesewas: 0,
      creditPesewas: allocatedFees,
      memo: 'Fee settlement',
    });
  }

  // If overpayment remains, credit Cash Clearing / Customer Advance (Liability)
  if (remainingPayment > 0) {
    journalLines.push({
      accountCode: '2010', // Settlement Payable / Overpayment
      debitPesewas: 0,
      creditPesewas: remainingPayment,
      memo: 'Borrower overpayment credit',
    });
  }

  const { journalEntryId } = await postJournalEntry({
    db,
    agencyId,
    actorId: cashierId,
    description: `Cashier repayment receipt ${reference}`,
    reference,
    lines: journalLines,
  });

  // 4. Record Cashier Payment
  const paymentId = ulid();
  await db
    .prepare(
      `INSERT INTO cashier_payments (
         id, agency_id, loan_id, cashier_id, amount_pesewas, payment_method,
         reference, allocated_principal_pesewas, allocated_interest_pesewas,
         allocated_fees_pesewas, journal_entry_id, is_reversed, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(
      paymentId,
      agencyId,
      loanId,
      cashierId,
      amountPesewas,
      paymentMethod,
      reference,
      allocatedPrincipal,
      allocatedInterest,
      allocatedFees,
      journalEntryId,
      now,
    )
    .run();

  // 5. Update loan balances
  const newPrincipal = Math.max(0, loan.outstanding_principal_pesewas - allocatedPrincipal);
  const newInterest = Math.max(0, loan.outstanding_interest_pesewas - allocatedInterest);
  const newFees = Math.max(0, loan.outstanding_fees_pesewas - allocatedFees);
  const isPaidOff = newPrincipal === 0 && newInterest === 0 && newFees === 0;

  await db
    .prepare(
      `UPDATE loans
       SET outstanding_principal_pesewas = ?,
           outstanding_interest_pesewas = ?,
           outstanding_fees_pesewas = ?,
           status = CASE WHEN ? = 1 THEN 'PAID_OFF' ELSE status END,
           closed_at = CASE WHEN ? = 1 THEN ? ELSE closed_at END,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(newPrincipal, newInterest, newFees, isPaidOff ? 1 : 0, isPaidOff ? 1 : 0, now, now, loanId)
    .run();

  if (isPaidOff) {
    await db
      .prepare(`UPDATE loan_applications SET status = 'PAID_OFF', updated_at = ? WHERE id = ?`)
      .bind(now, loan.application_id)
      .run();
  }

  // 6. Audit event
  await db
    .prepare(
      `INSERT INTO audit_events (id, agency_id, actor_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, 'CASHIER_PAYMENT_PROCESSED', 'loan', ?, ?, ?)`,
    )
    .bind(
      ulid(),
      agencyId,
      cashierId,
      loanId,
      JSON.stringify({
        paymentId,
        amountPesewas,
        allocatedPrincipal,
        allocatedInterest,
        allocatedFees,
        newPrincipal,
        isPaidOff,
      }),
      now,
    )
    .run();

  return {
    paymentId,
    journalEntryId,
    allocatedPrincipal,
    allocatedInterest,
    allocatedFees,
    remainingPrincipalPesewas: newPrincipal,
    isPaidOff,
  };
}

export interface ReversePaymentParams {
  db: D1Database;
  agencyId: string;
  paymentId: string;
  approvedBy: string;
  reason: string;
}

export async function reverseCashierPayment(params: ReversePaymentParams) {
  const { db, agencyId, paymentId, approvedBy, reason } = params;

  // 1. Fetch payment
  const payment = await db
    .prepare(
      `SELECT cp.id, cp.loan_id, cp.amount_pesewas, cp.allocated_principal_pesewas,
              cp.allocated_interest_pesewas, cp.allocated_fees_pesewas, cp.is_reversed,
              cp.journal_entry_id, l.outstanding_principal_pesewas, l.outstanding_interest_pesewas,
              l.outstanding_fees_pesewas, l.application_id
       FROM cashier_payments cp
       JOIN loans l ON l.id = cp.loan_id
       WHERE cp.id = ? AND cp.agency_id = ?`,
    )
    .bind(paymentId, agencyId)
    .first<{
      id: string;
      loan_id: string;
      amount_pesewas: number;
      allocated_principal_pesewas: number;
      allocated_interest_pesewas: number;
      allocated_fees_pesewas: number;
      is_reversed: number;
      journal_entry_id: string;
      outstanding_principal_pesewas: number;
      outstanding_interest_pesewas: number;
      outstanding_fees_pesewas: number;
      application_id: string;
    }>();

  if (!payment) {
    throw new Error('PAYMENT_NOT_FOUND');
  }

  if (payment.is_reversed === 1) {
    throw new Error('PAYMENT_ALREADY_REVERSED');
  }

  const now = Date.now();

  // 2. Post Compensating Reversal Journal Entry (Inverted Debits & Credits)
  const compensatingLines: JournalLineInput[] = [
    {
      accountCode: '1010', // Cash Clearing (Credit to reverse receipt)
      debitPesewas: 0,
      creditPesewas: payment.amount_pesewas,
      memo: `Reversal of payment ${paymentId}: ${reason}`,
    },
  ];

  if (payment.allocated_principal_pesewas > 0) {
    compensatingLines.push({
      accountCode: '1200', // Loans Receivable (Debit to restore balance)
      debitPesewas: payment.allocated_principal_pesewas,
      creditPesewas: 0,
      memo: 'Principal restoration',
    });
  }
  if (payment.allocated_interest_pesewas > 0) {
    compensatingLines.push({
      accountCode: '1210', // Interest Receivable (Debit to restore interest)
      debitPesewas: payment.allocated_interest_pesewas,
      creditPesewas: 0,
      memo: 'Interest restoration',
    });
  }
  if (payment.allocated_fees_pesewas > 0) {
    compensatingLines.push({
      accountCode: '1220', // Fees Receivable (Debit to restore fees)
      debitPesewas: payment.allocated_fees_pesewas,
      creditPesewas: 0,
      memo: 'Fee restoration',
    });
  }

  const { journalEntryId: compEntryId } = await postJournalEntry({
    db,
    agencyId,
    actorId: approvedBy,
    description: `Compensating reversal for receipt ${paymentId}`,
    reference: `REV-${paymentId}`,
    lines: compensatingLines,
  });

  // 3. Mark payment as reversed
  await db
    .prepare(`UPDATE cashier_payments SET is_reversed = 1 WHERE id = ?`)
    .bind(paymentId)
    .run();

  // 4. Insert payment reversal record
  const reversalId = ulid();
  await db
    .prepare(
      `INSERT INTO payment_reversals (id, agency_id, cashier_payment_id, reason, approved_by, compensating_journal_entry_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(reversalId, agencyId, paymentId, reason, approvedBy, compEntryId, now)
    .run();

  // 5. Restore loan outstanding balances
  const restoredPrincipal = payment.outstanding_principal_pesewas + payment.allocated_principal_pesewas;
  const restoredInterest = payment.outstanding_interest_pesewas + payment.allocated_interest_pesewas;
  const restoredFees = payment.outstanding_fees_pesewas + payment.allocated_fees_pesewas;

  await db
    .prepare(
      `UPDATE loans
       SET outstanding_principal_pesewas = ?,
           outstanding_interest_pesewas = ?,
           outstanding_fees_pesewas = ?,
           status = 'ACTIVE',
           closed_at = NULL,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(restoredPrincipal, restoredInterest, restoredFees, now, payment.loan_id)
    .run();

  // Revert application to ACTIVE
  await db
    .prepare(`UPDATE loan_applications SET status = 'ACTIVE', updated_at = ? WHERE id = ?`)
    .bind(now, payment.application_id)
    .run();

  // 6. Audit event
  await db
    .prepare(
      `INSERT INTO audit_events (id, agency_id, actor_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, 'PAYMENT_REVERSED', 'cashier_payment', ?, ?, ?)`,
    )
    .bind(
      ulid(),
      agencyId,
      approvedBy,
      paymentId,
      JSON.stringify({ reversalId, compEntryId, reason, restoredPrincipal }),
      now,
    )
    .run();

  return {
    reversalId,
    compensatingJournalEntryId: compEntryId,
    restoredPrincipalPesewas: restoredPrincipal,
  };
}
