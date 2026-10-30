import type { ApplicationStatus, UserRole } from '../domain/stateMachine.ts';

export interface ApplicationDisclosureRecord {
  id: string;
  agency_id: string;
  borrower_id: string;
  borrower_full_name?: string | null;
  borrower_email?: string | null;
  borrower_phone?: string | null;
  status: string;
  requested_amount_pesewas: number;
  tenure_months: number;
  purpose: string | null;
  assigned_lender_id: string | null;
  assigned_officer_id: string | null;
  submitted_at: number | null;
  created_at: number;
  updated_at: number;
}

const AGENCY_ROLES: readonly UserRole[] = [
  'agency_admin',
  'loan_officer',
  'underwriter',
  'auditor',
];

/**
 * Applies the current application disclosure matrix before serialization.
 * Borrowers receive application terms only; agency staff may receive the
 * borrower identity and internal review fields. Lender-facing disclosure is
 * intentionally not implemented until lender proposal routes exist.
 */
export function discloseApplication(row: ApplicationDisclosureRecord, role: UserRole) {
  const base = {
    id: row.id,
    status: row.status as ApplicationStatus,
    requestedAmountPesewas: row.requested_amount_pesewas,
    tenureMonths: row.tenure_months,
    purpose: row.purpose,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (!AGENCY_ROLES.includes(role)) return base;

  return {
    ...base,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_full_name,
    borrowerEmail: row.borrower_email,
    borrowerPhone: row.borrower_phone,
    assignedOfficerId: row.assigned_officer_id,
    submittedAt: row.submitted_at,
  };
}
