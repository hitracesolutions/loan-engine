/**
 * Gidfine Type Definitions
 * All monetary values in PESEWAS (integer minor units)
 * All rates in BASIS POINTS (integer, e.g., 1800 = 18.00%)
 */

// ============================================
// CORE TYPES
// ============================================

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "MORE_INFO_REQUIRED"
  | "MATCHING"
  | "LENDER_PENDING"
  | "LENDER_ACCEPTED"
  | "LENDER_DECLINED"
  | "AGENCY_APPROVED"
  | "AGENCY_REJECTED"
  | "BORROWER_PENDING"
  | "BORROWER_ACCEPTED"
  | "BORROWER_DECLINED"
  | "PENDING_DISBURSEMENT"
  | "CANCELLED"
  | "EXPIRED";

export type LoanStatus =
  | "PENDING_DISBURSEMENT"
  | "ACTIVE"
  | "PAID_OFF"
  | "CLOSED"
  | "DELINQUENT"
  | "RESTRUCTURED"
  | "CANCELLED";

export type ProposalStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "COUNTERED";

export type PaymentStatus = "PENDING" | "CLEARED" | "REVERSED" | "PARTIAL";

export type UserRole =
  | "BORROWER"
  | "LENDER"
  | "AGENCY_ADMIN"
  | "LOAN_OFFICER"
  | "CASHIER"
  | "AUDITOR"
  | "PLATFORM_ADMIN";

export type DocumentType =
  | "NATIONAL_ID"
  | "PASSPORT"
  | "DRIVERS_LICENSE"
  | "SALARY_SLIP"
  | "BANK_STATEMENT"
  | "EMPLOYER_LETTER"
  | "PROOF_OF_ADDRESS"
  | "OTHER";

export type RateBasis = "ANNUAL" | "MONTHLY" | "DAILY";
export type RateMethod = "FLAT" | "REDUCING_BALANCE" | "EFFECTIVE_ANNUAL";

// ============================================
// ENTITIES
// ============================================

export interface Agency {
  id: string;
  name: string;
  country: string;
  currency: string;
  agency_margin_bps: number;
  min_credit_score: number;
  max_dti_ratio_bps: number;
  created_at: string;
  updated_at: string;
}

export interface Borrower {
  id: string;
  email: string;
  phone?: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  id_number?: string;
  id_type?: DocumentType;
  employer?: string;
  monthly_salary_pesewas?: number;
  credit_score: number;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  created_at: string;
  updated_at: string;
}

export interface Lender {
  id: string;
  name: string;
  contact_email: string;
  contact_phone?: string;
  base_rate_bps: number;
  max_loan_pesewas: number;
  min_loan_pesewas: number;
  foir_limit_bps: number;
  approval_probability_bps: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface LenderProduct {
  id: string;
  lender_id: string;
  product_name: string;
  min_tenure_months?: number;
  max_tenure_months?: number;
  min_amount_pesewas: number;
  max_amount_pesewas: number;
  base_rate_bps: number;
  created_at: string;
}

export interface StaffUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  status: "ACTIVE" | "SUSPENDED";
  last_login?: string;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  borrower_id: string;
  amount_requested_pesewas: number;
  tenure_months: number;
  purpose: string;
  status: ApplicationStatus;
  rejection_reason?: string;
  created_at: string;
  submitted_at?: string;
  updated_at: string;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  document_type: DocumentType;
  r2_key: string;
  file_name: string;
  content_type?: string;
  file_size_bytes?: number;
  uploaded_at: string;
}

export interface LenderProposal {
  id: string;
  application_id: string;
  lender_id: string;
  status: ProposalStatus;
  lender_decision?: string;
  counter_offer_rate_bps?: number;
  counter_offer_amount_pesewas?: number;
  created_at: string;
  decided_at?: string;
}

export interface Loan {
  id: string;
  application_id: string;
  borrower_id: string;
  lender_id: string;
  principal_pesewas: number;
  lender_rate_bps: number;
  agency_margin_bps: number;
  borrower_rate_bps: number;
  tenure_months: number;
  status: LoanStatus;
  disbursed_pesewas?: number;
  disbursement_date?: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

export interface RepaymentSchedule {
  id: string;
  loan_id: string;
  instalment_number: number;
  due_date: string;
  amount_pesewas: number;
  status: PaymentStatus;
  grace_days: number;
}

export interface PaymentTransaction {
  id: string;
  loan_id: string;
  amount_pesewas: number;
  payment_method?: string;
  reference_number?: string;
  paid_date: string;
  posted_by?: string;
  status: "CLEARED" | "PENDING" | "REVERSED";
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  loan_id: string;
  entry_type: string;
  debit_pesewas?: number;
  credit_pesewas?: number;
  account: string;
  description?: string;
  reversal_of_id?: string;
  created_at: string;
  created_by?: string;
}

export interface DisclosurePolicy {
  id: string;
  name: string;
  role: UserRole;
  field_name: string;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
  timestamp: string;
}

export interface NotificationEvent {
  id: string;
  event_type: string;
  recipient_id: string;
  recipient_email?: string;
  recipient_type: "BORROWER" | "LENDER" | "STAFF";
  subject?: string;
  message: string;
  channel: "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";
  status: "PENDING" | "SENT" | "FAILED" | "BOUNCED";
  sent_at?: string;
  created_at: string;
}

export interface InterestPolicy {
  id: string;
  name: string;
  rate_basis: RateBasis;
  rate_method: RateMethod;
  version: number;
  active: boolean;
  created_at: string;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Partial<Borrower | StaffUser>;
  expires_in: number;
}

export interface CreateApplicationRequest {
  amount_requested_pesewas: number;
  tenure_months: number;
  purpose: string;
}

export interface QuoteResponse {
  loan_id: string;
  principal_pesewas: number;
  lender_rate_bps: number;
  agency_margin_bps: number;
  borrower_rate_bps: number;
  total_repayable_pesewas: number;
  monthly_instalment_pesewas: number;
  schedule: RepaymentSchedule[];
}

export interface ProposalResponse {
  id: string;
  lender_id: string;
  lender_name: string;
  status: ProposalStatus;
  rate_bps: number;
  created_at: string;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ============================================
// CALCULATION TYPES
// ============================================

export interface EMICalculation {
  principal_pesewas: number;
  rate_bps: number;
  tenure_months: number;
  monthly_emi_pesewas: number;
  total_interest_pesewas: number;
  total_repayable_pesewas: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  max_approved_pesewas?: number;
}

export interface FraudScore {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  signals: string[];
}

// ============================================
// CLOUDFLARE BINDINGS
// ============================================

export interface CloudflareEnv {
  DB: D1Database;
  R2: R2Bucket;
  CACHE: KVNamespace;
  QUEUE: Queue;
  DURABLE_OBJECTS: DurableObjectNamespace;
  JWT_SECRET: string;
  SENDGRID_API_KEY?: string;
  TWILIO_API_KEY?: string;
  ENVIRONMENT: "development" | "staging" | "production";
}

// Re-export Cloudflare types if needed
export interface D1Database {
  prepare(sql: string): any;
}

export interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<R2Objects>;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  uploaded: Date;
  httpEtag: string;
  storageClass: string;
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
}

export interface R2Objects {
  objects: R2Object[];
  delimitedPrefixes: string[];
  isTruncated: boolean;
  nextContinuationToken: string;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Queue {
  send(message: any): Promise<void>;
}

export interface DurableObjectNamespace {
  get(id: string): DurableObjectStub;
}

export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}
