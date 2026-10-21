/**
 * Gidfine Financial Ledger & Disbursement Types (Phase 4A)
 *
 * Foundational types and schema-level validation utilities for:
 * 1. Financial ledger entries (append-only, integer pesewas)
 * 2. Dual-authorization disbursement requests (Maker-Checker segregation of duties)
 * 3. Idempotency key validation and tenant scoping
 */

export type LedgerEntryType =
  | "DISBURSEMENT"
  | "REPAYMENT_PRINCIPAL"
  | "REPAYMENT_INTEREST"
  | "REPAYMENT_FEE"
  | "REVERSAL"
  | "ADJUSTMENT";

export const VALID_LEDGER_ENTRY_TYPES: readonly LedgerEntryType[] = [
  "DISBURSEMENT",
  "REPAYMENT_PRINCIPAL",
  "REPAYMENT_INTEREST",
  "REPAYMENT_FEE",
  "REVERSAL",
  "ADJUSTMENT",
] as const;

export type DisbursementRequestStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PROCESSED"
  | "CANCELLED";

export const VALID_DISBURSEMENT_STATUSES: readonly DisbursementRequestStatus[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PROCESSED",
  "CANCELLED",
] as const;

export type DisbursementChannel =
  | "MOMO"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "CASH";

export const VALID_DISBURSEMENT_CHANNELS: readonly DisbursementChannel[] = [
  "MOMO",
  "BANK_TRANSFER",
  "CHEQUE",
  "CASH",
] as const;

export interface LedgerEntryValidationInput {
  agencyId: string;
  applicationId: string;
  entryType: string;
  amountPesewas: number;
  currency: string;
  actorId: string;
  isReversal?: boolean;
  reversedEntryId?: string;
  idempotencyKey?: string;
}

export interface DisbursementRequestValidationInput {
  agencyId: string;
  applicationId: string;
  amountPesewas: number;
  currency: string;
  makerId: string;
  idempotencyKey: string;
  channel?: string;
}

/**
 * Validates ledger entry schema constraints prior to insertion.
 * Ensures integer pesewas, positive amounts, valid entry types, and reversal integrity.
 */
export function validateLedgerEntrySchema(input: LedgerEntryValidationInput): {
  isValid: boolean;
  error?: string;
} {
  if (!input.agencyId || typeof input.agencyId !== "string") {
    return { isValid: false, error: "Invalid agencyId: must be a non-empty string" };
  }
  if (!input.applicationId || typeof input.applicationId !== "string") {
    return { isValid: false, error: "Invalid applicationId: must be a non-empty string" };
  }
  if (!input.actorId || typeof input.actorId !== "string") {
    return { isValid: false, error: "Invalid actorId: must be a non-empty string" };
  }
  if (input.currency !== "GHS") {
    return { isValid: false, error: `Invalid currency: "${input.currency}". Expected "GHS"` };
  }
  if (
    typeof input.amountPesewas !== "number" ||
    !Number.isInteger(input.amountPesewas) ||
    input.amountPesewas <= 0
  ) {
    return {
      isValid: false,
      error: "Invalid amountPesewas: must be a positive integer representing minor units",
    };
  }
  if (!VALID_LEDGER_ENTRY_TYPES.includes(input.entryType as LedgerEntryType)) {
    return {
      isValid: false,
      error: `Invalid entryType: "${input.entryType}". Expected one of: ${VALID_LEDGER_ENTRY_TYPES.join(", ")}`,
    };
  }
  if (input.isReversal && !input.reversedEntryId) {
    return {
      isValid: false,
      error: "Invalid reversal entry: reversedEntryId must be provided when isReversal is true",
    };
  }
  return { isValid: true };
}

/**
 * Validates disbursement request schema constraints.
 * Ensures strict positive integer amount, GHS currency, valid channel, and non-empty idempotency key.
 */
export function validateDisbursementRequestSchema(
  input: DisbursementRequestValidationInput
): {
  isValid: boolean;
  error?: string;
} {
  if (!input.agencyId || typeof input.agencyId !== "string") {
    return { isValid: false, error: "Invalid agencyId: must be a non-empty string" };
  }
  if (!input.applicationId || typeof input.applicationId !== "string") {
    return { isValid: false, error: "Invalid applicationId: must be a non-empty string" };
  }
  if (!input.makerId || typeof input.makerId !== "string") {
    return { isValid: false, error: "Invalid makerId: must be a non-empty string" };
  }
  if (input.currency !== "GHS") {
    return { isValid: false, error: `Invalid currency: "${input.currency}". Expected "GHS"` };
  }
  if (
    typeof input.amountPesewas !== "number" ||
    !Number.isInteger(input.amountPesewas) ||
    input.amountPesewas <= 0
  ) {
    return {
      isValid: false,
      error: "Invalid amountPesewas: must be a positive integer representing minor units",
    };
  }
  if (!input.idempotencyKey || typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length === 0) {
    return {
      isValid: false,
      error: "Invalid idempotencyKey: must be a non-empty string scoped to agency",
    };
  }
  if (input.channel && !VALID_DISBURSEMENT_CHANNELS.includes(input.channel as DisbursementChannel)) {
    return {
      isValid: false,
      error: `Invalid channel: "${input.channel}". Expected one of: ${VALID_DISBURSEMENT_CHANNELS.join(", ")}`,
    };
  }
  return { isValid: true };
}

/**
 * Enforces the Maker-Checker segregation of duties rule:
 * The maker who initiated the disbursement request cannot approve or check their own request.
 */
export function validateMakerCheckerSegregation(
  makerId: string,
  checkerId: string
): {
  isValid: boolean;
  error?: string;
} {
  if (!makerId || !checkerId) {
    return { isValid: false, error: "Both makerId and checkerId must be provided" };
  }
  if (makerId === checkerId) {
    return {
      isValid: false,
      error: "Segregation of duties violation: Maker cannot approve their own disbursement request",
    };
  }
  return { isValid: true };
}

/**
 * Validates that an idempotency key is present and non-empty.
 * Explicitly guards future queries against querying or matching undefined/null as a shared key.
 */
export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && key.trim().length > 0;
}

/**
 * Validates payload equivalence for idempotent retries.
 * Reusing the same agency-scoped idempotency key with mismatched critical payload
 * parameters (amount or loan application) is a violation of the idempotency contract
 * and must be rejected rather than returning the existing record or creating a duplicate.
 */
export function evaluateIdempotencyPayloadMatch(
  existing: { amountPesewas: number; applicationId: string },
  incoming: { amountPesewas: number; applicationId: string }
): {
  isMatch: boolean;
  error?: string;
} {
  if (existing.amountPesewas !== incoming.amountPesewas) {
    return {
      isMatch: false,
      error: `Idempotency contract violation: Reused idempotency key with mismatched amount (existing: ${existing.amountPesewas} pesewas, incoming: ${incoming.amountPesewas} pesewas)`,
    };
  }
  if (existing.applicationId !== incoming.applicationId) {
    return {
      isMatch: false,
      error: `Idempotency contract violation: Reused idempotency key with mismatched applicationId (existing: "${existing.applicationId}", incoming: "${incoming.applicationId}")`,
    };
  }
  return { isMatch: true };
}

