/**
 * Lender Management, Product Catalogue, Matching & Pricing Routes.
 *
 * Implements Sprint 3:
 * - Onboarding and listing partner lenders and products.
 * - Matching engine trigger and masked proposal generation.
 * - PII-redacted lender portal proposal feed (O-06 compliance).
 * - Quote simulation and snapshot generation.
 */

import { executeMatching, createMaskedBorrowerSummary } from '../domain/matchingEngine.ts';
import { calculateQuote, type CalculationStrategy } from '../domain/pricingEngine.ts';
import { requireActor, requireRole } from '../lib/auth.ts';
import { badRequest, json, notFound, forbidden } from '../lib/http.ts';
import { ulid } from '../lib/ids.ts';
import type { RouteContext } from '../router.ts';

export async function createLender(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin');
  const body = await ctx.request.json().catch(() => null) as {
    name?: string;
    slug?: string;
    licenseNumber?: string;
    contactEmail?: string;
    contactPhone?: string;
  } | null;

  if (!body?.name?.trim() || !body?.slug?.trim() || !body?.contactEmail?.trim()) {
    throw badRequest('INVALID_PAYLOAD', 'Lender name, slug, and contactEmail are required');
  }

  const lenderId = ulid();
  const now = Date.now();

  await ctx.env.DB.prepare(
    `INSERT INTO lenders (id, agency_id, name, slug, license_number, contact_email, contact_phone, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
  )
    .bind(
      lenderId,
      actor.agencyId,
      body.name.trim(),
      body.slug.trim().toLowerCase(),
      body.licenseNumber?.trim() ?? null,
      body.contactEmail.trim().toLowerCase(),
      body.contactPhone?.trim() ?? null,
      now,
      now,
    )
    .run();

  return json(
    {
      lender: {
        id: lenderId,
        agencyId: actor.agencyId,
        name: body.name.trim(),
        slug: body.slug.trim().toLowerCase(),
        licenseNumber: body.licenseNumber ?? null,
        contactEmail: body.contactEmail.trim().toLowerCase(),
        status: 'ACTIVE',
        createdAt: now,
      },
    },
    201,
  );
}

export async function listLenders(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'loan_officer', 'underwriter');
  const lenders = await ctx.env.DB.prepare(
    `SELECT id, agency_id, name, slug, license_number, contact_email, contact_phone, status, created_at
     FROM lenders
     WHERE agency_id = ?
     ORDER BY name ASC`,
  )
    .bind(actor.agencyId)
    .all();

  return json({ lenders: lenders.results });
}

export async function createLenderProduct(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin');
  const lenderId = ctx.params.id;

  const body = await ctx.request.json().catch(() => null) as {
    productName?: string;
    productCode?: string;
    description?: string;
    minAmountPesewas?: number;
    maxAmountPesewas?: number;
    minTenureMonths?: number;
    maxTenureMonths?: number;
    nominalAnnualRateBps?: number;
    calculationStrategy?: CalculationStrategy;
    minMonthlyIncomePesewas?: number;
  } | null;

  if (
    !body?.productName?.trim() ||
    !body?.productCode?.trim() ||
    body?.minAmountPesewas == null ||
    body?.maxAmountPesewas == null ||
    body?.minTenureMonths == null ||
    body?.maxTenureMonths == null ||
    body?.nominalAnnualRateBps == null
  ) {
    throw badRequest('INVALID_PAYLOAD', 'Missing required product parameters');
  }

  const productId = ulid();
  const now = Date.now();

  await ctx.env.DB.prepare(
    `INSERT INTO lender_products (
       id, agency_id, lender_id, product_name, product_code, description,
       min_amount_pesewas, max_amount_pesewas, min_tenure_months, max_tenure_months,
       nominal_annual_rate_bps, calculation_strategy, is_active, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(
      productId,
      actor.agencyId,
      lenderId,
      body.productName.trim(),
      body.productCode.trim().toUpperCase(),
      body.description?.trim() ?? null,
      body.minAmountPesewas,
      body.maxAmountPesewas,
      body.minTenureMonths,
      body.maxTenureMonths,
      body.nominalAnnualRateBps,
      body.calculationStrategy ?? 'FLAT_SIMULATION',
      now,
      now,
    )
    .run();

  if (body.minMonthlyIncomePesewas != null) {
    await ctx.env.DB.prepare(
      `INSERT INTO product_eligibility_criteria (id, agency_id, product_id, min_monthly_income_pesewas, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(ulid(), actor.agencyId, productId, body.minMonthlyIncomePesewas, now)
      .run();
  }

  return json(
    {
      product: {
        id: productId,
        lenderId,
        productName: body.productName.trim(),
        productCode: body.productCode.trim().toUpperCase(),
        minAmountPesewas: body.minAmountPesewas,
        maxAmountPesewas: body.maxAmountPesewas,
        minTenureMonths: body.minTenureMonths,
        maxTenureMonths: body.maxTenureMonths,
        nominalAnnualRateBps: body.nominalAnnualRateBps,
        calculationStrategy: body.calculationStrategy ?? 'FLAT_SIMULATION',
        createdAt: now,
      },
    },
    201,
  );
}

export async function listLenderProducts(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'loan_officer', 'underwriter', 'lender');
  const lenderId = ctx.params.id;

  const products = await ctx.env.DB.prepare(
    `SELECT p.*, ec.min_monthly_income_pesewas
     FROM lender_products p
     LEFT JOIN product_eligibility_criteria ec ON ec.product_id = p.id
     WHERE p.agency_id = ? AND p.lender_id = ?
     ORDER BY p.product_name ASC`,
  )
    .bind(actor.agencyId, lenderId)
    .all();

  return json({ products: products.results });
}

export async function runMatching(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'loan_officer', 'underwriter');
  const applicationId = ctx.params.id;

  const result = await executeMatching({
    db: ctx.env.DB,
    agencyId: actor.agencyId,
    applicationId,
    actorId: actor.userId,
  });

  return json(result);
}

export async function listApplicationProposals(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'loan_officer', 'underwriter', 'borrower');
  const applicationId = ctx.params.id;

  // If borrower, verify application ownership
  if (actor.role === 'borrower') {
    const app = await ctx.env.DB.prepare(
      `SELECT id FROM loan_applications WHERE id = ? AND agency_id = ? AND borrower_id = ?`,
    )
      .bind(applicationId, actor.agencyId, actor.userId)
      .first();
    if (!app) {
      throw notFound('Application not found');
    }
  }

  const proposals = await ctx.env.DB.prepare(
    `SELECT lp.*, l.name as lender_name, prod.product_name, prod.product_code
     FROM lender_proposals lp
     JOIN lenders l ON l.id = lp.lender_id
     JOIN lender_products prod ON prod.id = lp.product_id
     WHERE lp.agency_id = ? AND lp.application_id = ?
     ORDER BY lp.created_at DESC`,
  )
    .bind(actor.agencyId, applicationId)
    .all();

  return json({ proposals: proposals.results });
}

/**
 * Lender Portal proposals feed.
 * STRICT PII REDACTION (O-06): Lenders must NEVER receive borrower full name,
 * email, phone, or raw national ID.
 */
export async function listLenderProposals(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'lender', 'agency_admin');

  // Find lender associated with actor
  let lenderId = (
    await ctx.env.DB.prepare(`SELECT lender_id FROM lender_users WHERE user_id = ? AND agency_id = ?`)
      .bind(actor.userId, actor.agencyId)
      .first<{ lender_id: string }>()
  )?.lender_id;

  if (!lenderId && actor.role === 'agency_admin') {
    // Agency admin inspecting lender queue
    const firstLender = await ctx.env.DB.prepare(`SELECT id FROM lenders WHERE agency_id = ? LIMIT 1`)
      .bind(actor.agencyId)
      .first<{ id: string }>();
    lenderId = firstLender?.id;
  }

  if (!lenderId) {
    return json({ proposals: [] });
  }

  const proposals = await ctx.env.DB.prepare(
    `SELECT lp.id as proposal_id, lp.status, lp.offered_amount_pesewas,
            lp.nominal_annual_rate_bps, lp.tenure_months, lp.notes, lp.created_at,
            la.id as application_id, la.requested_amount_pesewas, la.tenure_months as requested_tenure_months,
            bp.employer, bp.monthly_salary_pesewas as monthly_income_pesewas, bp.city as residential_city, bp.id_number_masked
     FROM lender_proposals lp
     JOIN loan_applications la ON la.id = lp.application_id
     LEFT JOIN borrower_profiles bp ON bp.user_id = la.borrower_id AND bp.agency_id = la.agency_id
     WHERE lp.agency_id = ? AND lp.lender_id = ?
     ORDER BY lp.created_at DESC`,
  )
    .bind(actor.agencyId, lenderId)
    .all<{
      proposal_id: string;
      status: string;
      offered_amount_pesewas: number;
      nominal_annual_rate_bps: number;
      tenure_months: number;
      notes: string | null;
      created_at: number;
      application_id: string;
      requested_amount_pesewas: number;
      requested_tenure_months: number;
      purpose: string | null;
      employment_type: string | null;
      monthly_income_pesewas: number | null;
      residential_city: string | null;
      id_number_masked: string | null;
    }>();

  // Return strictly masked PII summaries
  const maskedList = proposals.results.map((p) => {
    const masked = createMaskedBorrowerSummary({
      application: {
        id: p.application_id,
        requested_amount_pesewas: p.requested_amount_pesewas,
        tenure_months: p.requested_tenure_months,
        purpose: p.purpose,
      },
      profile: {
        employment_type: p.employment_type,
        monthly_income_pesewas: p.monthly_income_pesewas,
        residential_city: p.residential_city,
        id_number_masked: p.id_number_masked,
      },
    });

    return {
      proposalId: p.proposal_id,
      status: p.status,
      offeredAmountPesewas: p.offered_amount_pesewas,
      nominalAnnualRateBps: p.nominal_annual_rate_bps,
      tenureMonths: p.tenure_months,
      notes: p.notes,
      createdAt: p.created_at,
      borrowerSummary: masked,
    };
  });

  return json({ proposals: maskedList });
}

export async function respondToProposal(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'lender', 'agency_admin');
  const proposalId = ctx.params.id;

  const body = await ctx.request.json().catch(() => null) as {
    action?: 'ACCEPT' | 'DECLINE' | 'COUNTER';
    counterAmountPesewas?: number;
    counterRateBps?: number;
    counterTenureMonths?: number;
    notes?: string;
  } | null;

  if (!body?.action || !['ACCEPT', 'DECLINE', 'COUNTER'].includes(body.action)) {
    throw badRequest('INVALID_ACTION', 'Action must be ACCEPT, DECLINE, or COUNTER');
  }

  const prop = await ctx.env.DB.prepare(
    `SELECT id, agency_id, application_id, lender_id, status, offered_amount_pesewas,
            nominal_annual_rate_bps, tenure_months
     FROM lender_proposals
     WHERE id = ? AND agency_id = ?`,
  )
    .bind(proposalId, actor.agencyId)
    .first<{
      id: string;
      agency_id: string;
      application_id: string;
      lender_id: string;
      status: string;
      offered_amount_pesewas: number;
      nominal_annual_rate_bps: number;
      tenure_months: number;
    }>();

  if (!prop) {
    throw notFound('Proposal not found');
  }

  const now = Date.now();
  let newStatus: string = prop.status;

  if (body.action === 'ACCEPT') {
    newStatus = 'ACCEPTED';
  } else if (body.action === 'DECLINE') {
    newStatus = 'DECLINED';
  } else if (body.action === 'COUNTER') {
    newStatus = 'COUNTERED';
  }

  const offeredAmount = body.counterAmountPesewas ?? prop.offered_amount_pesewas;
  const offeredRate = body.counterRateBps ?? prop.nominal_annual_rate_bps;
  const offeredTenure = body.counterTenureMonths ?? prop.tenure_months;

  await ctx.env.DB.prepare(
    `UPDATE lender_proposals
     SET status = ?, offered_amount_pesewas = ?, nominal_annual_rate_bps = ?, tenure_months = ?,
         notes = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(newStatus, offeredAmount, offeredRate, offeredTenure, body.notes ?? null, now, proposalId)
    .run();

  // Insert proposal version
  const lastVersion = await ctx.env.DB.prepare(
    `SELECT coalesce(max(version_number), 0) as max_v FROM proposal_versions WHERE proposal_id = ?`,
  )
    .bind(proposalId)
    .first<{ max_v: number }>();

  await ctx.env.DB.prepare(
    `INSERT INTO proposal_versions (
       id, proposal_id, version_number, offered_amount_pesewas, nominal_annual_rate_bps,
       tenure_months, actor_id, action, notes, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      ulid(),
      proposalId,
      (lastVersion?.max_v ?? 0) + 1,
      offeredAmount,
      offeredRate,
      offeredTenure,
      actor.userId,
      body.action,
      body.notes ?? null,
      now,
    )
    .run();

  return json({
    proposalId,
    status: newStatus,
    offeredAmountPesewas: offeredAmount,
    nominalAnnualRateBps: offeredRate,
    tenureMonths: offeredTenure,
  });
}

export async function generateQuote(ctx: RouteContext): Promise<Response> {
  const actor = await requireActor(ctx);
  const applicationId = ctx.params.id;

  const body = await ctx.request.json().catch(() => null) as {
    proposalId?: string;
    principalPesewas?: number;
    nominalAnnualRateBps?: number;
    tenureMonths?: number;
    calculationStrategy?: CalculationStrategy;
    originationFeeBps?: number;
  } | null;

  let principal = body?.principalPesewas;
  let rateBps = body?.nominalAnnualRateBps;
  let tenure = body?.tenureMonths;
  let strategy = body?.calculationStrategy ?? 'FLAT_SIMULATION';

  if (body?.proposalId) {
    const prop = await ctx.env.DB.prepare(
      `SELECT offered_amount_pesewas, nominal_annual_rate_bps, tenure_months
       FROM lender_proposals
       WHERE id = ? AND agency_id = ?`,
    )
      .bind(body.proposalId, actor.agencyId)
      .first<{
        offered_amount_pesewas: number;
        nominal_annual_rate_bps: number;
        tenure_months: number;
      }>();
    if (prop) {
      principal = principal ?? prop.offered_amount_pesewas;
      rateBps = rateBps ?? prop.nominal_annual_rate_bps;
      tenure = tenure ?? prop.tenure_months;
    }
  }

  if (!principal || !rateBps || !tenure) {
    const app = await ctx.env.DB.prepare(
      `SELECT requested_amount_pesewas, tenure_months FROM loan_applications WHERE id = ? AND agency_id = ?`,
    )
      .bind(applicationId, actor.agencyId)
      .first<{ requested_amount_pesewas: number; tenure_months: number }>();
    if (!app) throw notFound('Application not found');
    principal = principal ?? app.requested_amount_pesewas;
    rateBps = rateBps ?? 2400; // 24% standard simulation rate
    tenure = tenure ?? app.tenure_months;
  }

  const quote = await calculateQuote({
    principalPesewas: principal,
    nominalAnnualRateBps: rateBps,
    tenureMonths: tenure,
    calculationStrategy: strategy,
    originationFeeBps: body?.originationFeeBps ?? 0,
  });

  const quoteId = ulid();
  const now = Date.now();

  await ctx.env.DB.prepare(
    `INSERT INTO quote_snapshots (
       id, agency_id, application_id, proposal_id, calculation_strategy,
       principal_pesewas, total_interest_pesewas, total_fees_pesewas,
       total_repayable_pesewas, monthly_repayment_pesewas, schedule_json,
       is_simulation, status, snapshot_hash, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'PROVISIONAL', ?, ?)`,
  )
    .bind(
      quoteId,
      actor.agencyId,
      applicationId,
      body?.proposalId ?? null,
      quote.calculationStrategy,
      quote.principalPesewas,
      quote.totalInterestPesewas,
      quote.totalFeesPesewas,
      quote.totalRepayablePesewas,
      quote.monthlyRepaymentPesewas,
      JSON.stringify(quote.installments),
      quote.snapshotHash,
      now,
    )
    .run();

  return json(
    {
      quoteId,
      ...quote,
      isSimulation: true,
      status: 'PROVISIONAL',
    },
    201,
  );
}
