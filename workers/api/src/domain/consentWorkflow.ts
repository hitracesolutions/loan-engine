/**
 * Borrower Consent & Offer Workflow.
 *
 * Implements Sprint 4 versioned offers, immutable cryptographic consent evidence,
 * and state-machine guarded transitions from AGENCY_APPROVED -> BORROWER_ACCEPTED.
 */

import { ulid } from '../lib/ids.ts';

export interface IssueOfferParams {
  db: D1Database;
  agencyId: string;
  applicationId: string;
  quoteSnapshotId: string;
  actorId: string;
  expiresInDays?: number;
}

export async function issueBorrowerOffer(params: IssueOfferParams) {
  const { db, agencyId, applicationId, quoteSnapshotId, actorId, expiresInDays = 7 } = params;

  // Verify quote snapshot
  const quote = await db
    .prepare(
      `SELECT id, principal_pesewas, monthly_repayment_pesewas, total_interest_pesewas, proposal_id
       FROM quote_snapshots
       WHERE id = ? AND agency_id = ? AND application_id = ?`,
    )
    .bind(quoteSnapshotId, agencyId, applicationId)
    .first<{
      id: string;
      principal_pesewas: number;
      monthly_repayment_pesewas: number;
      total_interest_pesewas: number;
      proposal_id: string | null;
    }>();

  if (!quote) {
    throw new Error('QUOTE_SNAPSHOT_NOT_FOUND');
  }

  // Fetch proposal for rate and tenure
  let rateBps = 2400; // default simulation 24%
  let tenureMonths = 12;

  if (quote.proposal_id) {
    const prop = await db
      .prepare(`SELECT nominal_annual_rate_bps, tenure_months FROM lender_proposals WHERE id = ?`)
      .bind(quote.proposal_id)
      .first<{ nominal_annual_rate_bps: number; tenure_months: number }>();
    if (prop) {
      rateBps = prop.nominal_annual_rate_bps;
      tenureMonths = prop.tenure_months;
    }
  }

  const now = Date.now();
  const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;
  const offerId = ulid();

  await db
    .prepare(
      `INSERT INTO borrower_offers (
         id, agency_id, application_id, quote_snapshot_id, offered_amount_pesewas,
         nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas,
         status, expires_at, created_by, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OFFERED', ?, ?, ?)`,
    )
    .bind(
      offerId,
      agencyId,
      applicationId,
      quote.id,
      quote.principal_pesewas,
      rateBps,
      tenureMonths,
      quote.monthly_repayment_pesewas,
      expiresAt,
      actorId,
      now,
    )
    .run();

  // Transition application to AGENCY_APPROVED
  await db
    .prepare(
      `UPDATE loan_applications
       SET status = 'AGENCY_APPROVED', updated_at = ?
       WHERE id = ? AND agency_id = ?`,
    )
    .bind(now, applicationId, agencyId)
    .run();

  // Audit event
  await db
    .prepare(
      `INSERT INTO audit_events (id, agency_id, actor_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, 'OFFER_ISSUED', 'borrower_offer', ?, ?, ?)`,
    )
    .bind(
      ulid(),
      agencyId,
      actorId,
      offerId,
      JSON.stringify({ applicationId, quoteSnapshotId, offeredAmountPesewas: quote.principal_pesewas, rateBps, tenureMonths }),
      now,
    )
    .run();

  return {
    offerId,
    expiresAt,
    offeredAmountPesewas: quote.principal_pesewas,
    monthlyRepaymentPesewas: quote.monthly_repayment_pesewas,
  };
}

export interface RecordConsentParams {
  db: D1Database;
  agencyId: string;
  applicationId: string;
  offerId: string;
  borrowerId: string;
  consentText: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordBorrowerConsent(params: RecordConsentParams) {
  const { db, agencyId, applicationId, offerId, borrowerId, consentText, ipAddress, userAgent } = params;

  // 1. Fetch offer and verify status
  const offer = await db
    .prepare(
      `SELECT id, application_id, offered_amount_pesewas, nominal_annual_rate_bps,
              tenure_months, monthly_repayment_pesewas, status, expires_at
       FROM borrower_offers
       WHERE id = ? AND agency_id = ? AND application_id = ?`,
    )
    .bind(offerId, agencyId, applicationId)
    .first<{
      id: string;
      application_id: string;
      offered_amount_pesewas: number;
      nominal_annual_rate_bps: number;
      tenure_months: number;
      monthly_repayment_pesewas: number;
      status: string;
      expires_at: number;
    }>();

  if (!offer) {
    throw new Error('OFFER_NOT_FOUND');
  }

  if (offer.status !== 'OFFERED') {
    throw new Error(`OFFER_NOT_PENDING: Status is ${offer.status}`);
  }

  const now = Date.now();
  if (now > offer.expires_at) {
    throw new Error('OFFER_EXPIRED');
  }

  // 2. Verify application belongs to borrower
  const app = await db
    .prepare(
      `SELECT id, borrower_id, status FROM loan_applications WHERE id = ? AND agency_id = ?`,
    )
    .bind(applicationId, agencyId)
    .first<{ id: string; borrower_id: string; status: string }>();

  if (!app) {
    throw new Error('APPLICATION_NOT_FOUND');
  }

  if (app.borrower_id !== borrowerId) {
    throw new Error('BORROWER_MISMATCH: Consent can only be provided by the owning borrower');
  }

  if (app.status !== 'AGENCY_APPROVED') {
    throw new Error(`INVALID_APPLICATION_STATUS: Expected AGENCY_APPROVED but found ${app.status}`);
  }

  // 3. Compute immutable SHA-256 terms hash
  const termsPayload = JSON.stringify({
    offerId: offer.id,
    applicationId: offer.application_id,
    borrowerId,
    offeredAmountPesewas: offer.offered_amount_pesewas,
    nominalAnnualRateBps: offer.nominal_annual_rate_bps,
    tenureMonths: offer.tenure_months,
    monthlyRepaymentPesewas: offer.monthly_repayment_pesewas,
    consentText,
    timestamp: now,
  });

  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(termsPayload));
  const termsHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const consentId = ulid();

  // 4. Save consent evidence
  await db
    .prepare(
      `INSERT INTO borrower_consents (
         id, agency_id, application_id, offer_id, borrower_id,
         consent_text, ip_address, user_agent, terms_hash, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      consentId,
      agencyId,
      applicationId,
      offer.id,
      borrowerId,
      consentText,
      ipAddress ?? null,
      userAgent ?? null,
      termsHash,
      now,
    )
    .run();

  // 5. Update offer status to ACCEPTED
  await db
    .prepare(`UPDATE borrower_offers SET status = 'ACCEPTED' WHERE id = ?`)
    .bind(offer.id)
    .run();

  // 6. Transition application to BORROWER_ACCEPTED
  await db
    .prepare(
      `UPDATE loan_applications
       SET status = 'BORROWER_ACCEPTED', updated_at = ?
       WHERE id = ? AND agency_id = ?`,
    )
    .bind(now, applicationId, agencyId)
    .run();

  // 7. Audit log
  await db
    .prepare(
      `INSERT INTO audit_events (id, agency_id, actor_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, 'BORROWER_CONSENT_RECORDED', 'loan_application', ?, ?, ?)`,
    )
    .bind(
      ulid(),
      agencyId,
      borrowerId,
      applicationId,
      JSON.stringify({ offerId, consentId, termsHash, ipAddress: ipAddress ?? 'unknown' }),
      now,
    )
    .run();

  return {
    consentId,
    termsHash,
    status: 'BORROWER_ACCEPTED',
  };
}
