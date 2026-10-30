/**
 * Borrower Offers, Cryptographic Consent & Maker-Checker Disbursement Dual-Control Routes.
 *
 * Implements Sprint 4:
 * - Versioned offer generation and lookup.
 * - Borrower cryptographic consent evidence recording (SHA-256 terms hash).
 * - Dual-control disbursement: Maker preparation, Checker confirmation with strict identity separation.
 */

import { issueBorrowerOffer, recordBorrowerConsent } from '../domain/consentWorkflow.ts';
import { prepareDisbursement, confirmDisbursement } from '../domain/makerCheckerDisbursement.ts';
import { requireActor, requireRole } from '../lib/auth.ts';
import { badRequest, conflict, forbidden, json, notFound } from '../lib/http.ts';
import type { RouteContext } from '../router.ts';

export async function createOffer(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'underwriter', 'loan_officer');
  const applicationId = ctx.params.id;

  const body = await ctx.request.json().catch(() => null) as {
    quoteSnapshotId?: string;
    expiresInDays?: number;
  } | null;

  if (!body?.quoteSnapshotId) {
    throw badRequest('MISSING_QUOTE_ID', 'quoteSnapshotId is required to issue an offer');
  }

  const result = await issueBorrowerOffer({
    db: ctx.env.DB,
    agencyId: actor.agencyId,
    applicationId,
    quoteSnapshotId: body.quoteSnapshotId,
    actorId: actor.userId,
    expiresInDays: body.expiresInDays,
  });

  return json(result, 201);
}

export async function getActiveOffer(ctx: RouteContext): Promise<Response> {
  const actor = await requireActor(ctx);
  const applicationId = ctx.params.id;

  // Borrower ownership check
  if (actor.role === 'borrower') {
    const app = await ctx.env.DB.prepare(
      `SELECT id FROM loan_applications WHERE id = ? AND agency_id = ? AND borrower_id = ?`,
    )
      .bind(applicationId, actor.agencyId, actor.userId)
      .first();
    if (!app) throw notFound('Application not found');
  }

  const offer = await ctx.env.DB.prepare(
    `SELECT bo.*, qs.schedule_json, qs.calculation_strategy
     FROM borrower_offers bo
     JOIN quote_snapshots qs ON qs.id = bo.quote_snapshot_id
     WHERE bo.agency_id = ? AND bo.application_id = ?
     ORDER BY bo.created_at DESC
     LIMIT 1`,
  )
    .bind(actor.agencyId, applicationId)
    .first<{
      id: string;
      offered_amount_pesewas: number;
      nominal_annual_rate_bps: number;
      tenure_months: number;
      monthly_repayment_pesewas: number;
      status: string;
      expires_at: number;
      schedule_json: string;
      calculation_strategy: string;
    }>();

  if (!offer) {
    return json({ offer: null });
  }

  return json({
    offer: {
      id: offer.id,
      offeredAmountPesewas: offer.offered_amount_pesewas,
      nominalAnnualRateBps: offer.nominal_annual_rate_bps,
      tenureMonths: offer.tenure_months,
      monthlyRepaymentPesewas: offer.monthly_repayment_pesewas,
      status: offer.status,
      expiresAt: offer.expires_at,
      calculationStrategy: offer.calculation_strategy,
      installments: JSON.parse(offer.schedule_json),
    },
  });
}

export async function submitBorrowerConsent(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'borrower');
  const applicationId = ctx.params.id;

  const body = await ctx.request.json().catch(() => null) as {
    offerId?: string;
    consentText?: string;
  } | null;

  if (!body?.offerId || !body?.consentText?.trim()) {
    throw badRequest('INVALID_PAYLOAD', 'offerId and consentText are required');
  }

  const ipAddress = ctx.request.headers.get('cf-connecting-ip') ?? ctx.request.headers.get('x-forwarded-for');
  const userAgent = ctx.request.headers.get('user-agent');

  try {
    const result = await recordBorrowerConsent({
      db: ctx.env.DB,
      agencyId: actor.agencyId,
      applicationId,
      offerId: body.offerId,
      borrowerId: actor.userId,
      consentText: body.consentText.trim(),
      ipAddress,
      userAgent,
    });

    return json(result, 201);
  } catch (err: any) {
    if (err.message && err.message.includes('OFFER_NOT_PENDING')) {
      throw conflict('OFFER_NOT_PENDING', err.message);
    }
    if (err.message && err.message.includes('OFFER_EXPIRED')) {
      throw conflict('OFFER_EXPIRED', err.message);
    }
    if (err.message && err.message.includes('BORROWER_MISMATCH')) {
      throw forbidden('Consent can only be provided by the owning borrower');
    }
    if (err.message && err.message.includes('OFFER_NOT_FOUND')) {
      throw notFound('Offer not found');
    }
    throw err;
  }
}

export async function prepareDisbursementHandler(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'loan_officer', 'cashier');
  const body = await ctx.request.json().catch(() => null) as {
    applicationId?: string;
    channel?: 'SIMULATED' | 'BANK_TRANSFER' | 'MOBILE_MONEY';
    destinationAccountMasked?: string;
    notes?: string;
  } | null;

  if (!body?.applicationId || !body?.channel || !body?.destinationAccountMasked) {
    throw badRequest('INVALID_PAYLOAD', 'applicationId, channel, and destinationAccountMasked are required');
  }

  const result = await prepareDisbursement({
    db: ctx.env.DB,
    agencyId: actor.agencyId,
    applicationId: body.applicationId,
    makerId: actor.userId,
    channel: body.channel,
    destinationAccountMasked: body.destinationAccountMasked,
    notes: body.notes,
  });

  return json(result, 201);
}

export async function confirmDisbursementHandler(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'cashier');
  const body = await ctx.request.json().catch(() => null) as {
    disbursementId?: string;
    notes?: string;
  } | null;

  if (!body?.disbursementId) {
    throw badRequest('INVALID_PAYLOAD', 'disbursementId is required');
  }

  try {
    const result = await confirmDisbursement({
      db: ctx.env.DB,
      agencyId: actor.agencyId,
      disbursementId: body.disbursementId,
      checkerId: actor.userId,
      notes: body.notes,
    });

    return json(result);
  } catch (err: any) {
    if (err.message && err.message.includes('MAKER_CANNOT_BE_CHECKER')) {
      throw forbidden('Maker and Checker must be separate identities');
    }
    if (err.message && err.message.includes('DISBURSEMENT_ALREADY_PROCESSED')) {
      throw conflict('ALREADY_PROCESSED', err.message);
    }
    throw err;
  }
}

export async function listDisbursements(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'cashier', 'loan_officer', 'auditor');

  const records = await ctx.env.DB.prepare(
    `SELECT d.*, la.requested_amount_pesewas, u_maker.full_name as maker_name, u_checker.full_name as checker_name
     FROM disbursement_records d
     JOIN loan_applications la ON la.id = d.application_id
     JOIN users u_maker ON u_maker.id = d.maker_id
     LEFT JOIN users u_checker ON u_checker.id = d.checker_id
     WHERE d.agency_id = ?
     ORDER BY d.prepared_at DESC`,
  )
    .bind(actor.agencyId)
    .all();

  return json({ disbursements: records.results });
}
