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
import { badRequest, conflict, json, notFound } from '../lib/http.ts';
import type { RouteContext } from '../router.ts';

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
  const actor = await requireActor(ctx);
  const loanId = ctx.params.id;

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
      borrower_id: string;
      [key: string]: any;
    }>();

  if (!loan) {
    throw notFound('Loan not found');
  }

  if (actor.role === 'borrower' && loan.borrower_id !== actor.userId) {
    throw notFound('Loan not found');
  }

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

export async function recordPayment(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'cashier', 'agency_admin');
  const loanId = ctx.params.id;

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
  const paymentId = ctx.params.id;

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
      if (!linesByEntry[line.journal_entry_id]) {
        linesByEntry[line.journal_entry_id] = [];
      }
      linesByEntry[line.journal_entry_id].push(line);
    }
  }

  const result = entries.results.map((entry) => ({
    ...entry,
    lines: linesByEntry[entry.id] ?? [],
  }));

  return json({ entries: result });
}
