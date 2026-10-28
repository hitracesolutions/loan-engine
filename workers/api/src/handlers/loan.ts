/**
 * Loan Handler — Loan & Repayment Management
 */

import type { CloudflareEnv } from "../types";
import { success, badRequest, notFound, unauthorized } from "../utils/response";
import { requireAuth } from "../utils/auth";
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "../services/cache";

/**
 * GET /loans/:id — Get loan details
 */
export async function getLoan(
  request: Request,
  env: CloudflareEnv,
  loanId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user) {
      return unauthorized();
    }

    // Cache loan details for 1 hour
    const loan = await cacheGetOrSet(
      env,
      CACHE_KEYS.loanSchedule(loanId),
      async () => {
        const stmt = env.DB.prepare("SELECT * FROM loans WHERE id = ?");
        return stmt.bind(loanId).first();
      },
      CACHE_TTL.LOAN_SCHEDULE
    );

    if (!loan) {
      return notFound("Loan not found");
    }

    // Verify access (borrower, lender, or staff)
    if (user.role === "BORROWER" && (loan as any).borrower_id !== user.sub) {
      return unauthorized();
    }

    return success(loan);
  } catch (error) {
    console.error("[LOAN] Get loan error:", error);
    return badRequest("Failed to fetch loan");
  }
}

/**
 * GET /loans/:id/schedule — Get repayment schedule
 */
export async function getSchedule(
  request: Request,
  env: CloudflareEnv,
  loanId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user) {
      return unauthorized();
    }

    const schedule = await cacheGetOrSet(
      env,
      `loan:${loanId}:schedule`,
      async () => {
        const stmt = env.DB.prepare(`
          SELECT id, instalment_number, due_date, amount_pesewas, status, grace_days
          FROM repayment_schedules
          WHERE loan_id = ?
          ORDER BY instalment_number ASC
        `);
        return stmt.bind(loanId).all();
      },
      CACHE_TTL.LOAN_SCHEDULE
    );

    return success(schedule.results || []);
  } catch (error) {
    console.error("[LOAN] Get schedule error:", error);
    return badRequest("Failed to fetch schedule");
  }
}

/**
 * GET /loans/:id/transactions — Get payment transactions
 */
export async function getTransactions(
  request: Request,
  env: CloudflareEnv,
  loanId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user) {
      return unauthorized();
    }

    const stmt = env.DB.prepare(`
      SELECT id, amount_pesewas, payment_method, reference_number, paid_date, status
      FROM payment_transactions
      WHERE loan_id = ?
      ORDER BY paid_date DESC
    `);

    const transactions = await stmt.bind(loanId).all();

    return success(transactions.results || []);
  } catch (error) {
    console.error("[LOAN] Get transactions error:", error);
    return badRequest("Failed to fetch transactions");
  }
}

/**
 * GET /borrower/loans — List borrower's loans
 */
export async function listBorrowerLoans(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user || user.role !== "BORROWER") {
      return unauthorized();
    }

    const stmt = env.DB.prepare(`
      SELECT id, principal_pesewas, borrower_rate_bps, tenure_months, status, disbursement_date, created_at
      FROM loans
      WHERE borrower_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const loans = await stmt.bind(user.sub).all();

    return success(loans.results || []);
  } catch (error) {
    console.error("[LOAN] List borrower loans error:", error);
    return badRequest("Failed to fetch loans");
  }
}
