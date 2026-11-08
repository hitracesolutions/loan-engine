/**
 * Loan Servicing, Waterfall Cashier Payments & Double-Entry Ledger Routes.
 *
 * Implements Sprint 5:
 * - Active loan portfolio tracking.
 * - Repayment schedule & installment status lookup.
 * - Cashier repayment processing with Waterfall priority (Fees -> Interest -> Principal).
 * - Compensating payment reversals (never delete posted financial records).
 * - Double-entry balanced journal entry inspection for auditors.
 */

import { processCashierPayment, reverseCashierPayment } from '../domain/financialLedger.ts';
import { requireActor, requireRole } from '../lib/auth.ts';
import { badRequest, conflict, forbidden, json, notFound } from '../lib/http.ts';
import type { RouteContext } from '../router.ts';

/**
 * Helper to fetch a loan within the authenticated actor's agency,
 * enforcing tenant isolation and borrower ownership.
 * Throws 404 if the loan does not exist or if a borrower tries to access another borrower's loan.
 */
async function resolveLoanForActor(
  ctx: RouteContext,
  loanId: string,
) {
  const actor = await requireActor(ctx);

  const loan = await ctx.env.DB.prepare(
    `SELECT l.*, u.full_name as borrower_name, u.email as borrower_email, lend.name as lender_name
     FROM loans l
     JOIN users u ON u.id = l.borrower_id
     JOIN lenders lend ON lend.id = l.lender_id
     WHERE l.id = ? AND l.agency_id = ?`,
  )
    .bind(loanId, actor.agencyId)
    .first<{
      id: string;
      agency_id: string;
      borrower_id: string;
      outstanding_principal_pesewas: number;
      outstanding_interest_pesewas: number;
      outstanding_fees_pesewas: number;
      status: string;
      [key: string]: any;
    }>();

  if (!loan) {
    throw notFound('Loan not found');
  }

  if (actor.role === 'borrower' && loan.borrower_id !== actor.userId) {
    throw notFound('Loan not found');
  }

  return { actor, loan };
}

export async function listLoans(ctx: RouteContext): Promise<Response> {
  const actor = await requireActor(ctx);

  let query = `
    SELECT l.*, u.full_name as borrower_name, u.email as borrower_email, lend.name as lender_name
    FROM loans l
    JOIN users u ON u.id = l.borrower_id
    JOIN lenders lend ON lend.id = l.lender_id
    WHERE l.agency_id = ?
  `;
  const params: any[] = [actor.agencyId];

  if (actor.role === 'borrower') {
    query += ` AND l.borrower_id = ?`;
    params.push(actor.userId);
  }

  query += ` ORDER BY l.created_at DESC`;

  const loans = await ctx.env.DB.prepare(query).bind(...params).all();
  return json({ loans: loans.results });
}

export async function getLoanDetails(ctx: RouteContext): Promise<Response> {
  const loanId = ctx.params.id;
  const { actor, loan } = await resolveLoanForActor(ctx, loanId);

  // Get active repayment schedule & installments
  const installments = await ctx.env.DB.prepare(
    `SELECT ri.*
     FROM repayment_installments ri
     JOIN repayment_schedules rs ON rs.id = ri.schedule_id
     WHERE rs.loan_id = ? AND rs.agency_id = ?
     ORDER BY ri.installment_number ASC`,
  )
    .bind(loanId, actor.agencyId)
    .all();

  // Get payment history
  const payments = await ctx.env.DB.prepare(
    `SELECT cp.*, u.full_name as cashier_name
     FROM cashier_payments cp
     JOIN users u ON u.id = cp.cashier_id
     WHERE cp.loan_id = ? AND cp.agency_id = ?
     ORDER BY cp.created_at DESC`,
  )
    .bind(loanId, actor.agencyId)
    .all();

  return json({
    loan,
    installments: installments.results,
    payments: payments.results,
  });
}

/**
 * GET /loans/:id/schedule
 * Retrieves repayment installments for a loan in ascending installment order.
 */
export async function getLoanSchedule(ctx: RouteContext): Promise<Response> {
  const loanId = ctx.params.id;
  const { actor } = await resolveLoanForActor(ctx, loanId);

  const installments = await ctx.env.DB.prepare(
    `SELECT ri.*
     FROM repayment_installments ri
     JOIN repayment_schedules rs ON rs.id = ri.schedule_id
     WHERE rs.loan_id = ? AND rs.agency_id = ?
     ORDER BY ri.installment_number ASC`,
  )
    .bind(loanId, actor.agencyId)
    .all();

  const results = installments.results ?? [];
  return json({
    loanId,
    installments: results,
    results,
  });
}

/**
 * GET /loans/:id/transactions
 * Retrieves cashier payments and cashier names for a loan in descending creation order.
 */
export async function getLoanTransactions(ctx: RouteContext): Promise<Response> {
  const loanId = ctx.params.id;
  const { actor } = await resolveLoanForActor(ctx, loanId);

  const payments = await ctx.env.DB.prepare(
    `SELECT cp.*, u.full_name as cashier_name
     FROM cashier_payments cp
     JOIN users u ON u.id = cp.cashier_id
     WHERE cp.loan_id = ? AND cp.agency_id = ?
     ORDER BY cp.created_at DESC`,
  )
    .bind(loanId, actor.agencyId)
    .all();

  const results = payments.results ?? [];
  return json({
    loanId,
    payments: results,
    results,
  });
}

/**
 * GET /loans/:id/outstanding
 * Calculates and returns outstanding principal, interest, fees, and total in integer pesewas.
 */
export async function getLoanOutstanding(ctx: RouteContext): Promise<Response> {
  const loanId = ctx.params.id;
  const { loan } = await resolveLoanForActor(ctx, loanId);

  const principalPesewas = Number(loan.outstanding_principal_pesewas ?? 0);
  const interestPesewas = Number(loan.outstanding_interest_pesewas ?? 0);
  const feesPesewas = Number(loan.outstanding_fees_pesewas ?? 0);
  const totalOutstandingPesewas = principalPesewas + interestPesewas + feesPesewas;

  return json({
    loanId: loan.id,
    status: loan.status,
    outstanding: {
      principalPesewas,
      interestPesewas,
      feesPesewas,
      totalPesewas: totalOutstandingPesewas,
    },
    outstandingPrincipalPesewas: principalPesewas,
    outstandingInterestPesewas: interestPesewas,
    outstandingFeesPesewas: feesPesewas,
    totalOutstandingPesewas,
  });
}

export async function recordPayment(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'cashier', 'agency_admin');
  const loanId = ctx.params.id ?? '';

  const body = await ctx.request.json().catch(() => null) as {
    amountPesewas?: number;
    paymentMethod?: 'CASH' | 'SIMULATED_MOMO' | 'SIMULATED_BANK';
    reference?: string;
  } | null;

  if (!body?.amountPesewas || !body?.paymentMethod || !body?.reference?.trim()) {
    throw badRequest('INVALID_PAYLOAD', 'amountPesewas, paymentMethod, and reference are required');
  }

  try {
    const result = await processCashierPayment({
      db: ctx.env.DB,
      agencyId: actor.agencyId,
      loanId,
      cashierId: actor.userId,
      amountPesewas: body.amountPesewas,
      paymentMethod: body.paymentMethod,
      reference: body.reference.trim(),
    });

    return json(result, 201);
  } catch (err: any) {
    if (err.message && err.message.includes('DUPLICATE_PAYMENT_REFERENCE')) {
      throw conflict('DUPLICATE_PAYMENT', err.message);
    }
    if (err.message && err.message.includes('LOAN_NOT_FOUND')) {
      throw notFound('Loan not found');
    }
    throw err;
  }
}

export async function reversePayment(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin');
  const paymentId = ctx.params.id ?? '';

  const body = await ctx.request.json().catch(() => null) as {
    reason?: string;
  } | null;

  if (!body?.reason?.trim()) {
    throw badRequest('INVALID_PAYLOAD', 'A non-empty reason is required for payment reversal');
  }

  try {
    const result = await reverseCashierPayment({
      db: ctx.env.DB,
      agencyId: actor.agencyId,
      paymentId,
      approvedBy: actor.userId,
      reason: body.reason.trim(),
    });

    return json(result);
  } catch (err: any) {
    if (err.message && err.message.includes('PAYMENT_ALREADY_REVERSED')) {
      throw conflict('PAYMENT_ALREADY_REVERSED', err.message);
    }
    if (err.message && err.message.includes('SELF_REVERSAL_FORBIDDEN')) {
      throw forbidden('The user who recorded a payment cannot approve its reversal');
    }
    if (err.message && err.message.includes('PAYMENT_NOT_FOUND')) {
      throw notFound('Payment not found');
    }
    throw err;
  }
}

export async function listJournalEntries(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'auditor', 'cashier');

  const entries = await ctx.env.DB.prepare(
    `SELECT je.*, u.full_name as created_by_name
     FROM journal_entries je
     JOIN users u ON u.id = je.created_by
     WHERE je.agency_id = ?
     ORDER BY je.entry_number DESC
     LIMIT 100`,
  )
    .bind(actor.agencyId)
    .all<{ id: string; [key: string]: any }>();

  // Fetch lines for entries
  const entryIds = entries.results.map((e) => e.id);
  const linesByEntry: Record<string, any[]> = {};

  if (entryIds.length > 0) {
    const lines = await ctx.env.DB.prepare(
      `SELECT jl.*, a.code as account_code, a.name as account_name
       FROM journal_lines jl
       JOIN accounts a ON a.id = jl.account_id
       ORDER BY jl.created_at ASC`,
    ).all<{ journal_entry_id: string; [key: string]: any }>();

    for (const line of lines.results) {
      (linesByEntry[line.journal_entry_id] ??= []).push(line);
    }
  }

  const result = entries.results.map((entry) => ({
    ...entry,
    lines: linesByEntry[entry.id] ?? [],
  }));

  return json({ entries: result });
}
