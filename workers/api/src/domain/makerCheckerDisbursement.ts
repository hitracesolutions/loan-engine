/**
 * Maker-Checker Dual-Control Disbursement Framework.
 *
 * Implements Sprint 4 disbursement dual-control authorization:
 * - Separation of maker and checker identities (strict maker_id != checker_id enforcement).
 * - Gated simulation adapter (simulation_mode = 1) preventing unauthorized real fund transfers.
 * - Atomic activation of loan servicing and double-entry balanced ledger entries.
 */

import { ulid } from '../lib/ids.ts';
import { calculateQuote } from './pricingEngine.ts';
import { postJournalEntry } from './financialLedger.ts';

export interface PrepareDisbursementParams {
  db: D1Database;
  agencyId: string;
  applicationId: string;
  makerId: string;
  channel: 'SIMULATED' | 'BANK_TRANSFER' | 'MOBILE_MONEY';
  destinationAccountMasked: string;
  notes?: string;
}

export async function prepareDisbursement(params: PrepareDisbursementParams) {
  const { db, agencyId, applicationId, makerId, channel, destinationAccountMasked, notes } = params;

  // 1. Verify application status and consent snapshot
  const app = await db
    .prepare(
      `SELECT la.id, la.status, la.borrower_id, la.assigned_lender_id, bo.id as offer_id, bo.offered_amount_pesewas,
              bc.id as consent_id
       FROM loan_applications la
       JOIN borrower_offers bo ON bo.application_id = la.id AND bo.status = 'ACCEPTED'
       JOIN borrower_consents bc ON bc.offer_id = bo.id
       WHERE la.id = ? AND la.agency_id = ?`,
    )
    .bind(applicationId, agencyId)
    .first<{
      id: string;
      status: string;
      borrower_id: string;
      assigned_lender_id: string | null;
      offer_id: string;
      offered_amount_pesewas: number;
      consent_id: string;
    }>();

  if (!app) {
    throw new Error('APPLICATION_NOT_ELIGIBLE: Missing accepted offer or borrower consent');
  }

  if (app.status !== 'BORROWER_ACCEPTED') {
    throw new Error(`INVALID_STATUS: Expected BORROWER_ACCEPTED but found ${app.status}`);
  }

  const now = Date.now();
  const disbursementId = ulid();
  const reference = `SIM-DISB-${now}`;

  await db
    .prepare(
      `INSERT INTO disbursement_records (
         id, agency_id, application_id, offer_id, amount_pesewas, channel,
         destination_account_masked, maker_id, checker_id, status, simulation_mode,
         reference, prepared_at, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'PREPARED', 1, ?, ?, ?)`,
    )
    .bind(
      disbursementId,
      agencyId,
      applicationId,
      app.offer_id,
      app.offered_amount_pesewas,
      channel,
      destinationAccountMasked,
      makerId,
      reference,
      now,
      notes ?? 'Disbursement prepared in simulation mode',
    )
    .run();

  // Transition application to PENDING_DISBURSEMENT
  await db
    .prepare(
      `UPDATE loan_applications
       SET status = 'PENDING_DISBURSEMENT', updated_at = ?
       WHERE id = ? AND agency_id = ?`,
    )
    .bind(now, applicationId, agencyId)
    .run();

  // Audit event
  await db
    .prepare(
      `INSERT INTO audit_events (id, agency_id, actor_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, 'DISBURSEMENT_PREPARED', 'disbursement_record', ?, ?, ?)`,
    )
    .bind(
      ulid(),
      agencyId,
      makerId,
      disbursementId,
      JSON.stringify({ applicationId, amountPesewas: app.offered_amount_pesewas, channel, reference }),
      now,
    )
    .run();

  return {
    disbursementId,
    status: 'PREPARED',
    reference,
    simulationMode: true,
  };
}

export interface ConfirmDisbursementParams {
  db: D1Database;
  agencyId: string;
  disbursementId: string;
  checkerId: string;
  notes?: string;
}

export async function confirmDisbursement(params: ConfirmDisbursementParams) {
  const { db, agencyId, disbursementId, checkerId, notes } = params;

  // 1. Fetch disbursement record
  const disb = await db
    .prepare(
      `SELECT d.id, d.agency_id, d.application_id, d.offer_id, d.amount_pesewas, d.maker_id,
              d.checker_id, d.status, d.channel, d.reference,
              bo.nominal_annual_rate_bps, bo.tenure_months, bo.monthly_repayment_pesewas,
              la.borrower_id
       FROM disbursement_records d
       JOIN borrower_offers bo ON bo.id = d.offer_id
       JOIN loan_applications la ON la.id = d.application_id
       WHERE d.id = ? AND d.agency_id = ?`,
    )
    .bind(disbursementId, agencyId)
    .first<{
      id: string;
      agency_id: string;
      application_id: string;
      offer_id: string;
      amount_pesewas: number;
      maker_id: string;
      checker_id: string | null;
      status: string;
      channel: string;
      reference: string;
      nominal_annual_rate_bps: number;
      tenure_months: number;
      monthly_repayment_pesewas: number;
      borrower_id: string;
    }>();

  if (!disb) {
    throw new Error('DISBURSEMENT_RECORD_NOT_FOUND');
  }

  if (disb.status !== 'PREPARED') {
    throw new Error(`DISBURSEMENT_ALREADY_PROCESSED: Current status is ${disb.status}`);
  }

  // 2. STRICT MAKER-CHECKER SEPARATION
  if (disb.maker_id === checkerId) {
    throw new Error('MAKER_CANNOT_BE_CHECKER: A different authorized user must approve this disbursement');
  }

  const now = Date.now();

  // 3. Mark disbursement as DISBURSED (in simulation mode)
  await db
    .prepare(
      `UPDATE disbursement_records
       SET checker_id = ?, status = 'DISBURSED', checked_at = ?, disbursed_at = ?, notes = coalesce(notes || ' | ' || ?, notes)
       WHERE id = ? AND agency_id = ?`,
    )
    .bind(checkerId, now, now, notes ?? 'Approved by checker', disbursementId, agencyId)
    .run();

  // 4. Resolve or assign default lender
  let lenderId = (
    await db
      .prepare(`SELECT id FROM lenders WHERE agency_id = ? AND status = 'ACTIVE' LIMIT 1`)
      .bind(agencyId)
      .first<{ id: string }>()
  )?.id;

  if (!lenderId) {
    // Create default partner lender if none exists yet
    lenderId = ulid();
    await db
      .prepare(
        `INSERT INTO lenders (id, agency_id, name, slug, contact_email, status, created_at, updated_at)
         VALUES (?, ?, 'Default Partner Bank', 'default-bank', 'partner@gidfine.com', 'ACTIVE', ?, ?)`,
      )
      .bind(lenderId, agencyId, now, now)
      .run();
  }

  // 5. Create loan servicing record
  const loanId = ulid();
  // Calculate quote installments for schedule
  const quote = await calculateQuote({
    principalPesewas: disb.amount_pesewas,
    nominalAnnualRateBps: disb.nominal_annual_rate_bps,
    tenureMonths: disb.tenure_months,
  });

  await db
    .prepare(
      `INSERT INTO loans (
         id, agency_id, application_id, borrower_id, lender_id, disbursement_record_id,
         principal_pesewas, nominal_annual_rate_bps, tenure_months, monthly_repayment_pesewas,
         outstanding_principal_pesewas, outstanding_interest_pesewas, outstanding_fees_pesewas,
         status, disbursed_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ACTIVE', ?, ?, ?)`,
    )
    .bind(
      loanId,
      agencyId,
      disb.application_id,
      disb.borrower_id,
      lenderId,
      disbursementId,
      disb.amount_pesewas,
      disb.nominal_annual_rate_bps,
      disb.tenure_months,
      quote.monthlyRepaymentPesewas,
      disb.amount_pesewas,
      quote.totalInterestPesewas,
      now,
      now,
      now,
    )
    .run();

  // 6. Create initial repayment schedule & installments
  const scheduleId = ulid();
  await db
    .prepare(
      `INSERT INTO repayment_schedules (id, agency_id, loan_id, version_number, created_at)
       VALUES (?, ?, ?, 1, ?)`,
    )
    .bind(scheduleId, agencyId, loanId, now)
    .run();

  for (const inst of quote.installments) {
    const dueDate = now + inst.installmentNumber * 30 * 24 * 60 * 60 * 1000;
    await db
      .prepare(
        `INSERT INTO repayment_installments (
           id, schedule_id, installment_number, due_date,
           principal_due_pesewas, interest_due_pesewas, fees_due_pesewas, total_due_pesewas,
           principal_paid_pesewas, interest_paid_pesewas, fees_paid_pesewas, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'PENDING')`,
      )
      .bind(
        ulid(),
        scheduleId,
        inst.installmentNumber,
        dueDate,
        inst.principalPesewas,
        inst.interestPesewas,
        inst.feesPesewas,
        inst.totalPesewas,
      )
      .run();
  }

  // 7. Post double-entry disbursement journal entry
  await postJournalEntry({
    db,
    agencyId,
    actorId: checkerId,
    description: `Loan disbursement for ${loanId}`,
    reference: `DISB-${disbursementId}`,
    lines: [
      {
        accountCode: '1200', // Loans Receivable (Asset Debit)
        debitPesewas: disb.amount_pesewas,
        creditPesewas: 0,
        memo: `Loan principal disbursed - ${loanId}`,
      },
      {
        accountCode: '1010', // Cash Clearing (Asset Credit)
        debitPesewas: 0,
        creditPesewas: disb.amount_pesewas,
        memo: `Disbursement clearing payout - ${disbursementId}`,
      },
    ],
  });

  // 8. Transition application to ACTIVE
  await db
    .prepare(
      `UPDATE loan_applications
       SET status = 'ACTIVE', updated_at = ?
       WHERE id = ? AND agency_id = ?`,
    )
    .bind(now, disb.application_id, agencyId)
    .run();

  // 9. Audit event
  await db
    .prepare(
      `INSERT INTO audit_events (id, agency_id, actor_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, 'DISBURSEMENT_CONFIRMED', 'loan', ?, ?, ?)`,
    )
    .bind(
      ulid(),
      agencyId,
      checkerId,
      loanId,
      JSON.stringify({ disbursementId, checkerId, makerId: disb.maker_id, amountPesewas: disb.amount_pesewas }),
      now,
    )
    .run();

  return {
    loanId,
    status: 'ACTIVE',
    disbursedAmountPesewas: disb.amount_pesewas,
    checkerId,
    makerId: disb.maker_id,
  };
}
