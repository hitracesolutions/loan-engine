/**
 * Payment Handler — Payment Processing & Tracking
 */

import type { CloudflareEnv } from "../types";
import { success, badRequest, notFound, unauthorized } from "../utils/response";
import { requireAuth } from "../utils/auth";
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from "../services/cache";
import { checkRateLimit, RATE_LIMITS } from "../middleware/rate-limit";
import { ids } from "../utils/id";

/**
 * POST /loans/:id/payments — Submit payment
 */
export async function submitPayment(
  request: Request,
  env: CloudflareEnv,
  loanId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user || user.role !== "BORROWER") {
      return unauthorized();
    }

    // Rate limit payments
    const rateLimit = await checkRateLimit(env, user.sub, "PAYMENT_SUBMIT");
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: rateLimit.message }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await request.json()) as any;
    const { amount_pesewas, payment_method, reference_number, idempotency_key } = body;

    if (!amount_pesewas || !payment_method) {
      return badRequest("amount_pesewas and payment_method required");
    }

    // Check idempotency (prevent duplicate payments)
    if (idempotency_key) {
      const cached = await cacheGet(env, CACHE_KEYS.paymentIdempotent(idempotency_key));
      if (cached) {
        return success({ id: cached.id, status: "PENDING" }, 201);
      }
    }

    // Verify loan ownership and status
    const loanStmt = env.DB.prepare("SELECT id, status FROM loans WHERE id = ? AND borrower_id = ?");
    const loan = await loanStmt.bind(loanId, user.sub).first<any>();

    if (!loan) {
      return notFound("Loan not found");
    }

    if (loan.status !== "ACTIVE") {
      return badRequest("Loan must be active to accept payments");
    }

    // Create payment transaction
    const paymentId = ids.payment();
    const insertStmt = env.DB.prepare(`
      INSERT INTO payment_transactions (id, loan_id, amount_pesewas, payment_method, reference_number, status, paid_date)
      VALUES (?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
    `);

    await insertStmt.bind(paymentId, loanId, amount_pesewas, payment_method, reference_number).run();

    // Cache idempotency key
    if (idempotency_key) {
      await cacheSet(
        env,
        CACHE_KEYS.paymentIdempotent(idempotency_key),
        { id: paymentId, amount_pesewas },
        CACHE_TTL.PAYMENT_IDEMPOTENT
      );
    }

    // Queue notification
    const notifId = ids.notification();
    const notifStmt = env.DB.prepare(`
      INSERT INTO notification_events (id, event_type, recipient_id, recipient_type, message, channel, status)
      VALUES (?, 'PAYMENT_RECEIVED', ?, 'BORROWER', ?, 'IN_APP', 'PENDING')
    `);

    await notifStmt.bind(notifId, user.sub, `Payment of ${amount_pesewas} pesewas received`).run();

    return success(
      { id: paymentId, loan_id: loanId, amount_pesewas, status: "PENDING" },
      201
    );
  } catch (error) {
    console.error("[PAYMENT] Submit payment error:", error);
    return badRequest("Failed to process payment");
  }
}

/**
 * GET /loans/:id/outstanding — Get outstanding balance
 */
export async function getOutstanding(
  request: Request,
  env: CloudflareEnv,
  loanId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user) {
      return unauthorized();
    }

    // Get loan details
    const loanStmt = env.DB.prepare("SELECT principal_pesewas FROM loans WHERE id = ?");
    const loan = await loanStmt.bind(loanId).first<any>();

    if (!loan) {
      return notFound("Loan not found");
    }

    // Get total payments made
    const paymentStmt = env.DB.prepare(`
      SELECT COALESCE(SUM(amount_pesewas), 0) as total_paid
      FROM payment_transactions
      WHERE loan_id = ? AND status = 'CLEARED'
    `);
    const payment = await paymentStmt.bind(loanId).first<any>();

    const outstanding = loan.principal_pesewas - (payment?.total_paid || 0);

    return success({
      loan_id: loanId,
      principal_pesewas: loan.principal_pesewas,
      paid_pesewas: payment?.total_paid || 0,
      outstanding_pesewas: Math.max(0, outstanding),
    });
  } catch (error) {
    console.error("[PAYMENT] Get outstanding error:", error);
    return badRequest("Failed to calculate outstanding balance");
  }
}
