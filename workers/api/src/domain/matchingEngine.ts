/**
 * Matching Engine & Borrower Data Masking.
 *
 * Implements deterministic matching between loan applications and active lender products.
 * Strictly enforces owner decision O-06: Lenders are never exposed to borrower PII
 * (no full name, phone, email, or unmasked national ID) during matching and proposal review.
 */

import { ulid } from '../lib/ids.ts';

export interface MaskedBorrowerProfile {
  applicationId: string;
  requestedAmountPesewas: number;
  tenureMonths: number;
  purpose: string | null;
  employmentType: string | null;
  incomeBand: string | null;
  residentialCity: string | null;
  maskedNationalId: string | null;
  creditScoreTier: string;
}

export function createMaskedBorrowerSummary(params: {
  application: {
    id: string;
    requested_amount_pesewas: number;
    tenure_months: number;
    purpose?: string | null;
  };
  profile?: {
    employment_type?: string | null;
    monthly_income_pesewas?: number | null;
    residential_city?: string | null;
    id_type?: string | null;
    id_number_masked?: string | null;
  } | null;
}): MaskedBorrowerProfile {
  const { application, profile } = params;

  let incomeBand = 'UNKNOWN';
  if (profile?.monthly_income_pesewas != null) {
    const incomeCedis = profile.monthly_income_pesewas / 100;
    if (incomeCedis < 1500) incomeBand = 'UNDER_1500';
    else if (incomeCedis <= 5000) incomeBand = '1500_5000';
    else if (incomeCedis <= 15000) incomeBand = '5001_15000';
    else incomeBand = 'ABOVE_15000';
  }

  // Credit tier placeholder (safe simulation band)
  const creditScoreTier = profile?.monthly_income_pesewas && profile.monthly_income_pesewas > 300000 ? 'TIER_A' : 'TIER_B';

  return {
    applicationId: application.id,
    requestedAmountPesewas: application.requested_amount_pesewas,
    tenureMonths: application.tenure_months,
    purpose: application.purpose ?? null,
    employmentType: profile?.employment_type ?? null,
    incomeBand,
    residentialCity: profile?.residential_city ?? null,
    maskedNationalId: profile?.id_number_masked ?? null,
    creditScoreTier,
  };
}

export interface MatchedProduct {
  productId: string;
  lenderId: string;
  lenderName: string;
  productName: string;
  productCode: string;
  nominalAnnualRateBps: number;
  calculationStrategy: string;
  minAmountPesewas: number;
  maxAmountPesewas: number;
  minTenureMonths: number;
  maxTenureMonths: number;
}

export async function executeMatching(params: {
  db: D1Database;
  agencyId: string;
  applicationId: string;
  actorId: string;
}): Promise<{
  matchingRunId: string;
  matches: MatchedProduct[];
  proposalsCreated: number;
}> {
  const { db, agencyId, applicationId, actorId } = params;

  // 1. Fetch application
  const app = await db
    .prepare(
      `SELECT id, agency_id, requested_amount_pesewas, tenure_months, status
       FROM loan_applications
       WHERE id = ? AND agency_id = ?`,
    )
    .bind(applicationId, agencyId)
    .first<{
      id: string;
      agency_id: string;
      requested_amount_pesewas: number;
      tenure_months: number;
      status: string;
    }>();

  if (!app) {
    throw new Error('APPLICATION_NOT_FOUND');
  }

  // 2. Fetch borrower profile (if available) for eligibility evaluation
  const profile = await db
    .prepare(
      `SELECT bp.monthly_salary_pesewas as monthly_income_pesewas, bp.city as residential_city
       FROM borrower_profiles bp
       JOIN loan_applications la ON la.borrower_id = bp.user_id AND la.agency_id = bp.agency_id
       WHERE la.id = ?`,
    )
    .bind(applicationId)
    .first<{ monthly_income_pesewas: number | null; residential_city: string | null }>();

  // 3. Query active lender products matching loan boundaries
  const productsQuery = await db
    .prepare(
      `SELECT p.id, p.lender_id, l.name as lender_name, p.product_name, p.product_code,
              p.nominal_annual_rate_bps, p.calculation_strategy,
              p.min_amount_pesewas, p.max_amount_pesewas,
              p.min_tenure_months, p.max_tenure_months,
              ec.min_monthly_income_pesewas, ec.allowed_employment_types
       FROM lender_products p
       JOIN lenders l ON l.id = p.lender_id AND l.status = 'ACTIVE'
       LEFT JOIN product_eligibility_criteria ec ON ec.product_id = p.id
       WHERE p.agency_id = ?
         AND p.is_active = 1
         AND p.min_amount_pesewas <= ?
         AND p.max_amount_pesewas >= ?
         AND p.min_tenure_months <= ?
         AND p.max_tenure_months >= ?`,
    )
    .bind(
      agencyId,
      app.requested_amount_pesewas,
      app.requested_amount_pesewas,
      app.tenure_months,
      app.tenure_months,
    )
    .all<{
      id: string;
      lender_id: string;
      lender_name: string;
      product_name: string;
      product_code: string;
      nominal_annual_rate_bps: number;
      calculation_strategy: string;
      min_amount_pesewas: number;
      max_amount_pesewas: number;
      min_tenure_months: number;
      max_tenure_months: number;
      min_monthly_income_pesewas: number | null;
      allowed_employment_types: string | null;
    }>();

  const matches: MatchedProduct[] = [];
  const borrowerIncome = profile?.monthly_income_pesewas ?? 0;

  for (const prod of productsQuery.results) {
    if (prod.min_monthly_income_pesewas != null && borrowerIncome < prod.min_monthly_income_pesewas) {
      continue;
    }
    matches.push({
      productId: prod.id,
      lenderId: prod.lender_id,
      lenderName: prod.lender_name,
      productName: prod.product_name,
      productCode: prod.product_code,
      nominalAnnualRateBps: prod.nominal_annual_rate_bps,
      calculationStrategy: prod.calculation_strategy,
      minAmountPesewas: prod.min_amount_pesewas,
      maxAmountPesewas: prod.max_amount_pesewas,
      minTenureMonths: prod.min_tenure_months,
      maxTenureMonths: prod.max_tenure_months,
    });
  }

  const now = Date.now();
  const matchingRunId = ulid();

  await db
    .prepare(
      `INSERT INTO matching_runs (id, agency_id, application_id, executed_by, matched_products_count, results_summary, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`,
    )
    .bind(
      matchingRunId,
      agencyId,
      applicationId,
      actorId,
      matches.length,
      JSON.stringify({ matchCount: matches.length, matchedProductCodes: matches.map((m) => m.productCode) }),
      now,
    )
    .run();

  let proposalsCreated = 0;
  // Automatically generate proposal placeholders for matches if no proposals exist yet
  for (const match of matches) {
    const existing = await db
      .prepare(
        `SELECT id FROM lender_proposals
         WHERE agency_id = ? AND application_id = ? AND lender_id = ? AND product_id = ?`,
      )
      .bind(agencyId, applicationId, match.lenderId, match.productId)
      .first<{ id: string }>();

    if (!existing) {
      const proposalId = ulid();
      await db
        .prepare(
          `INSERT INTO lender_proposals (
             id, agency_id, application_id, lender_id, product_id,
             status, offered_amount_pesewas, nominal_annual_rate_bps, tenure_months, notes,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          proposalId,
          agencyId,
          applicationId,
          match.lenderId,
          match.productId,
          app.requested_amount_pesewas,
          match.nominalAnnualRateBps,
          app.tenure_months,
          `Generated by matching run ${matchingRunId}`,
          now,
          now,
        )
        .run();

      await db
        .prepare(
          `INSERT INTO proposal_versions (
             id, proposal_id, version_number, offered_amount_pesewas, nominal_annual_rate_bps, tenure_months,
             actor_id, action, notes, created_at
           ) VALUES (?, ?, 1, ?, ?, ?, ?, 'INITIAL_MATCH', 'Initial matched proposal created', ?)`,
        )
        .bind(
          ulid(),
          proposalId,
          app.requested_amount_pesewas,
          match.nominalAnnualRateBps,
          app.tenure_months,
          actorId,
          now,
        )
        .run();

      proposalsCreated++;
    }
  }

  return {
    matchingRunId,
    matches,
    proposalsCreated,
  };
}
