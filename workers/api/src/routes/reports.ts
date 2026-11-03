/**
 * Supervisor reconciliation reports.
 *
 * Daily disbursement reconciliation is the compensating control named in
 * ADR-0018 / ADR-0009: it must exist and pass before single-approver (tiered)
 * disbursement can be enabled. It is read-only — it compares the operational
 * record of what was disbursed against the double-entry ledger and surfaces any
 * discrepancy, so money moving without a matching ledger entry (or vice versa)
 * is caught the next business day.
 */

import { requireRole } from '../lib/auth.ts';
import { badRequest, json } from '../lib/http.ts';
import type { RouteContext } from '../router.ts';

/** UTC [start, end) epoch-ms bounds for a YYYY-MM-DD date. */
function dayBoundsUtc(dateStr: string): { start: number; end: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw badRequest('INVALID_DATE', 'date must be in YYYY-MM-DD format');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw badRequest('INVALID_DATE', 'date is not a valid calendar date');
  }
  const start = Date.UTC(year, month - 1, day);
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

interface DisbursementRow {
  id: string;
  amount_pesewas: number;
  disbursed_at: number;
  maker_id: string;
  checker_id: string | null;
  reference: string;
}

/**
 * GET /reports/disbursement-reconciliation?date=YYYY-MM-DD
 * Supervisors only (agency_admin, auditor). Defaults to today (UTC).
 */
export async function disbursementReconciliation(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'auditor');
  const dateParam = ctx.url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const { start, end } = dayBoundsUtc(dateParam);

  // Operational side: disbursements marked DISBURSED on the day.
  const disbursements = await ctx.env.DB.prepare(
    `SELECT id, amount_pesewas, disbursed_at, maker_id, checker_id, reference
       FROM disbursement_records
       WHERE agency_id = ? AND status = 'DISBURSED' AND disbursed_at >= ? AND disbursed_at < ?
       ORDER BY disbursed_at ASC`,
  )
    .bind(actor.agencyId, start, end)
    .all<DisbursementRow>();

  const rows = disbursements.results ?? [];
  const operationalTotalPesewas = rows.reduce((sum, r) => sum + r.amount_pesewas, 0);

  // Ledger side: principal debited to Loans Receivable (1200) by disbursement
  // journal entries on the day.
  const ledger = await ctx.env.DB.prepare(
    `SELECT COALESCE(SUM(jl.debit_pesewas), 0) AS total
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       JOIN accounts a ON a.id = jl.account_id
       WHERE je.agency_id = ? AND je.reference LIKE 'DISB-%'
         AND je.entry_date >= ? AND je.entry_date < ? AND a.code = '1200'`,
  )
    .bind(actor.agencyId, start, end)
    .first<{ total: number }>();

  const ledgerTotalPesewas = ledger?.total ?? 0;
  const discrepancyPesewas = operationalTotalPesewas - ledgerTotalPesewas;

  return json({
    date: dateParam,
    disbursementCount: rows.length,
    operationalTotalPesewas,
    ledgerTotalPesewas,
    discrepancyPesewas,
    balanced: discrepancyPesewas === 0,
    disbursements: rows,
  });
}
