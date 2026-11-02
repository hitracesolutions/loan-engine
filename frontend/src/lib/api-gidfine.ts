/**
 * Gidfine API Client — Updated for Cloudflare Workers Backend
 *
 * This replaces the legacy FastAPI client with endpoints matching the new
 * Cloudflare Workers + D1 + KV architecture.
 *
 * Key changes:
 * - Uses JSON instead of FormData
 * - Uses `email` instead of `phone`
 * - Returns JWT tokens for authentication
 * - Simpler request/response format
 */

import { API_BASE } from './config';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    fullName?: string;
    agencyId?: string;
    role?: string;
    email: string;
    phone?: string | null;
  };
  expires_in: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: string;
}

export interface ErrorResponse {
  error: {
    code?: string;
    message?: string;
  };
  details?: Record<string, unknown>;
  timestamp: string;
}

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'MATCHING'
  | 'LENDER_PENDING'
  | 'LENDER_ACCEPTED'
  | 'AGENCY_APPROVED'
  | 'BORROWER_ACCEPTED'
  | 'PENDING_DISBURSEMENT'
  | 'ACTIVE'
  | 'PAID_OFF'
  | 'CLOSED'
  | 'MORE_INFO_REQUIRED'
  | 'LENDER_DECLINED'
  | 'AGENCY_REJECTED'
  | 'BORROWER_DECLINED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'DELINQUENT'
  | 'RESTRUCTURED';

export interface ApplicationRecord {
  id: string;
  status: ApplicationStatus;
  requestedAmountPesewas: number;
  tenureMonths: number;
  purpose: string | null;
  borrowerId?: string;
  borrowerName?: string | null;
  borrowerEmail?: string | null;
  borrowerPhone?: string | null;
  assignedOfficerId?: string | null;
  submittedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ApplicationStatusHistoryEntry {
  id: string;
  actorId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  reason: string | null;
  createdAt: number;
}

export interface ApplicationReviewNote {
  id: string;
  actorId: string;
  note: string;
  createdAt: number;
}

export interface ApplicationReview {
  application: ApplicationRecord;
  notes: ApplicationReviewNote[];
  statusHistory: ApplicationStatusHistoryEntry[];
}

interface ApiEnvelope<T> {
  ok?: boolean;
  data?: T;
  error?: ErrorResponse['error'];
  requestId?: string;
}

const IMPERSONATION_STATE_KEY = 'gidfine.impersonation';
const IMPERSONATION_ADMIN_TOKEN_KEY = 'gidfine.impersonation.admin_token';

export interface ImpersonationTargetUser {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

/** Row shape returned by GET /admin/users. */
export interface AdminUserSummary extends ImpersonationTargetUser {
  isActive: number;
}

export interface ImpersonationState {
  id: string;
  /** Epoch seconds, as issued by the API. */
  expiresAt: number;
  impersonatedBy: string;
  targetUser: ImpersonationTargetUser;
}

class GidfineAPI {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
    // Load token from localStorage if available
    this.token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    customHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    // Add authorization header if token exists
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch {
      throw new Error('Unable to reach the backend service. Please check your connection and try again.');
    }

    // Handle non-OK responses
    if (!response.ok) {
      if (response.status === 401) {
        // Invalidate stale authentication state centrally
        this.token = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          window.dispatchEvent(new CustomEvent('gidfine:auth-invalidated'));
        }
        let message = 'Authentication required. Please sign in to continue.';
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          try {
            const errorData = (await response.json()) as Partial<ErrorResponse>;
            if (errorData.error?.message) {
              message = errorData.error.message;
            }
          } catch {
            // retain fallback message
          }
        }
        throw new Error(message);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const errorData = (await response.json()) as Partial<ErrorResponse>;
        throw new Error(errorData.error?.message || 'API request failed');
      }
      throw new Error('The service returned an invalid response. Please try again later.');
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('The service returned an unexpected content type.');
    }

    const payload = (await response.json()) as ApiEnvelope<T> | T;
    if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) {
      return payload.data;
    }
    return payload as T;
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('POST', '/auth/login', {
      email,
      password,
    });

    // Store token for future requests
    if (response.token) {
      this.token = response.token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', response.token);
      }
    }

    return response;
  }

  async register(
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    agencySlug?: string,
  ): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('POST', '/auth/register', {
      email,
      password,
      fullName,
      phone,
      agencySlug,
    });

    // Store token for future requests
    if (response.token) {
      this.token = response.token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', response.token);
      }
    }

    return response;
  }

  logout(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new CustomEvent('gidfine:auth-invalidated'));
    }
  }

  // ============================================
  // BORROWER PROFILE
  // ============================================

  async getBorrowerProfile(): Promise<any> {
    return this.request('GET', '/borrower/profile');
  }

  async updateBorrowerProfile(profileData: {
    fullName?: string;
    phone?: string;
    dateOfBirth?: string;
    idType?: string;
    idNumber?: string;
    first_name?: string;
    last_name?: string;
    employer?: string;
    monthlySalaryPesewas?: number;
    monthly_salary_pesewas?: number;
    city?: string;
  }): Promise<any> {
    return this.request('PUT', '/borrower/profile', profileData);
  }

  // ============================================
  // APPLICATIONS
  // ============================================

  async listApplications(options: {
    status?: ApplicationStatus;
    assignedOfficerId?: string;
  } = {}): Promise<ApplicationRecord[]> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.assignedOfficerId) params.set('assignedOfficerId', options.assignedOfficerId);
    const query = params.toString();
    const response = (await this.request('GET', `/applications${query ? `?${query}` : ''}`)) as
      | ApplicationRecord[]
      | { applications?: ApplicationRecord[]; results?: ApplicationRecord[] };
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.applications)) return response.applications;
    if (response && Array.isArray(response.results)) return response.results;
    return [];
  }

  async assignApplication(applicationId: string, assigneeId: string): Promise<{
    applicationId: string;
    assignedOfficerId: string;
    updatedAt: number;
  }> {
    return this.request('POST', `/applications/${applicationId}/assign`, { assigneeId });
  }

  async reviewApplication(
    applicationId: string,
    targetStatus: ApplicationStatus,
    reason?: string,
  ): Promise<{
    applicationId: string;
    fromStatus: ApplicationStatus;
    status: ApplicationStatus;
    updatedAt: number;
  }> {
    return this.request('POST', `/applications/${applicationId}/review`, {
      targetStatus,
      ...(reason ? { reason } : {}),
    });
  }

  async addApplicationReviewNote(applicationId: string, note: string): Promise<ApplicationReviewNote> {
    return this.request('POST', `/applications/${applicationId}/notes`, { note });
  }

  async getApplicationReview(applicationId: string): Promise<ApplicationReview> {
    const response = (await this.request('GET', `/applications/${applicationId}/review`)) as {
      application: ApplicationRecord;
      notes?: Array<{
        id: string;
        actor_id?: string;
        actorId?: string;
        note: string;
        created_at?: number;
        createdAt?: number;
      }>;
      statusHistory?: Array<{
        id: string;
        actor_id?: string;
        actorId?: string;
        from_status?: ApplicationStatus | null;
        fromStatus?: ApplicationStatus | null;
        to_status?: ApplicationStatus;
        toStatus?: ApplicationStatus;
        reason: string | null;
        created_at?: number;
        createdAt?: number;
      }>;
    };

    return {
      application: response.application,
      notes: (response.notes ?? []).map((note) => ({
        id: note.id,
        actorId: note.actorId ?? note.actor_id ?? '',
        note: note.note,
        createdAt: note.createdAt ?? note.created_at ?? 0,
      })),
      statusHistory: (response.statusHistory ?? []).map((entry) => ({
        id: entry.id,
        actorId: entry.actorId ?? entry.actor_id ?? '',
        fromStatus: entry.fromStatus ?? entry.from_status ?? null,
        toStatus: entry.toStatus ?? entry.to_status ?? 'SUBMITTED',
        reason: entry.reason,
        createdAt: entry.createdAt ?? entry.created_at ?? 0,
      })),
    };
  }

  async createApplication(
    data: {
      requestedAmountPesewas?: number;
      amount_requested_pesewas?: number;
      tenureMonths?: number;
      tenure_months?: number;
      purpose?: string;
    },
    idempotencyKey?: string,
  ): Promise<any> {
    const requestedAmountPesewas = data.requestedAmountPesewas ?? data.amount_requested_pesewas ?? 0;
    const tenureMonths = data.tenureMonths ?? data.tenure_months ?? 12;
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }
    return this.request(
      'POST',
      '/applications',
      {
        requestedAmountPesewas,
        tenureMonths,
        purpose: data.purpose ?? '',
      },
      headers,
    );
  }

  async submitApplication(applicationId: string): Promise<any> {
    return this.request('POST', `/applications/${applicationId}/transition`, { targetStatus: 'SUBMITTED' });
  }

  async addApplicationNote(applicationId: string, noteText: string): Promise<any> {
    return this.request('POST', `/applications/${applicationId}/notes`, { noteText, note: noteText });
  }

  async getApplicationNotes(applicationId: string): Promise<any> {
    const response = (await this.request('GET', `/applications/${applicationId}/notes`)) as any;
    return response.notes || response;
  }

  async submitBorrowerResponse(applicationId: string, response: string): Promise<any> {
    return this.request('POST', `/applications/${applicationId}/response`, { response });
  }

  async transitionApplication(
    applicationId: string,
    targetStatus: string,
    reason?: string,
    note?: string,
  ): Promise<any> {
    return this.request('POST', `/applications/${applicationId}/transition`, {
      targetStatus,
      reason,
      note,
    });
  }

  // ============================================
  // LOANS
  // ============================================

  async listLoans(): Promise<any[]> {
    const response = (await this.request('GET', '/loans')) as any;
    return response.loans || response.results || response;
  }

  async getLoanDetails(loanId: string): Promise<any> {
    return this.request('GET', `/loans/${loanId}`);
  }

  async getRepaymentSchedule(loanId: string): Promise<any[]> {
    const response = (await this.request('GET', `/loans/${loanId}/schedule`)) as any;
    return response.results || response;
  }

  async getPaymentTransactions(loanId: string): Promise<any[]> {
    const response = (await this.request('GET', `/loans/${loanId}/transactions`)) as any;
    return response.results || response;
  }

  async getOutstandingBalance(loanId: string): Promise<any> {
    return this.request('GET', `/loans/${loanId}/outstanding`);
  }

  // ============================================
  // PAYMENTS
  // ============================================

  async submitPayment(loanId: string, data: {
    amount_pesewas: number;
    payment_method: string;
    reference_number?: string;
    idempotency_key?: string;
  }): Promise<any> {
    return this.request('POST', `/loans/${loanId}/payments`, data);
  }

  // ============================================
  // SPRINT 3: LENDERS, PRODUCTS & MATCHING
  // ============================================

  async listLenders(): Promise<any> {
    return this.request('GET', '/lenders');
  }

  async createLender(data: { name: string; slug: string; contactEmail: string; licenseNumber?: string; contactPhone?: string }): Promise<any> {
    return this.request('POST', '/lenders', data);
  }

  async listLenderProducts(lenderId: string): Promise<any> {
    return this.request('GET', `/lenders/${lenderId}/products`);
  }

  async createLenderProduct(lenderId: string, data: any): Promise<any> {
    return this.request('POST', `/lenders/${lenderId}/products`, data);
  }

  async runMatching(applicationId: string): Promise<any> {
    return this.request('POST', `/applications/${applicationId}/match`);
  }

  async listApplicationProposals(applicationId: string): Promise<any> {
    return this.request('GET', `/applications/${applicationId}/matches`);
  }

  async listLenderProposals(): Promise<any> {
    return this.request('GET', '/lender/proposals');
  }

  async respondToProposal(proposalId: string, data: { action: 'ACCEPT' | 'DECLINE' | 'COUNTER'; notes?: string; counterAmountPesewas?: number; counterRateBps?: number; counterTenureMonths?: number }): Promise<any> {
    return this.request('POST', `/lender/proposals/${proposalId}/respond`, data);
  }

  async generateQuote(applicationId: string, data?: any): Promise<any> {
    return this.request('POST', `/applications/${applicationId}/quote`, data);
  }

  // ============================================
  // SPRINT 4: OFFERS, CONSENT & DISBURSEMENT
  // ============================================

  async createOffer(applicationId: string, data: { quoteSnapshotId: string; expiresInDays?: number }): Promise<any> {
    return this.request('POST', `/applications/${applicationId}/offer`, data);
  }

  async getActiveOffer(applicationId: string): Promise<any> {
    return this.request('GET', `/applications/${applicationId}/offer`);
  }

  async submitBorrowerConsent(applicationId: string, data: { offerId: string; consentText: string }): Promise<any> {
    return this.request('POST', `/applications/${applicationId}/consent`, data);
  }

  async prepareDisbursement(data: { applicationId: string; channel: string; destinationAccountMasked: string; notes?: string }): Promise<any> {
    return this.request('POST', '/disbursements/prepare', data);
  }

  async confirmDisbursement(data: { disbursementId: string; notes?: string }): Promise<any> {
    return this.request('POST', '/disbursements/confirm', data);
  }

  async listDisbursements(): Promise<any> {
    return this.request('GET', '/disbursements');
  }

  // ============================================
  // SPRINT 5: SERVICING & FINANCIAL LEDGER
  // ============================================

  async recordCashierPayment(loanId: string, data: { amountPesewas: number; paymentMethod: string; reference: string }): Promise<any> {
    return this.request('POST', `/loans/${loanId}/payments`, data);
  }

  async reversePayment(paymentId: string, data: { reason: string }): Promise<any> {
    return this.request('POST', `/payments/${paymentId}/reverse`, data);
  }

  async listJournalEntries(): Promise<any> {
    return this.request('GET', '/ledger/entries');
  }

  // ============================================
  // SPRINT 6 & 7: DOCUMENTS, OUTBOX & HARDENING
  // ============================================

  async createDocument(data: any): Promise<any> {
    return this.request('POST', '/documents', data);
  }

  async listDocuments(params?: { entityType?: string; entityId?: string }): Promise<any> {
    const q = params ? `?entityType=${params.entityType ?? ''}&entityId=${params.entityId ?? ''}` : '';
    return this.request('GET', `/documents${q}`);
  }

  async setupMfa(): Promise<any> {
    return this.request('POST', '/auth/mfa/setup');
  }

  async verifyMfa(code: string): Promise<any> {
    return this.request('POST', '/auth/mfa/verify', { code });
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async healthCheck(): Promise<any> {
    return this.request('GET', '/health');
  }

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

  setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  // ============================================
  // ADMIN IMPERSONATION ("view as")
  // ============================================

  async listImpersonatableUsers(): Promise<{ users: AdminUserSummary[] }> {
    return this.request('GET', '/admin/users');
  }

  async startImpersonation(userId: string): Promise<{ token: string; impersonation: ImpersonationState }> {
    const response = await this.request<{ token: string; impersonation: ImpersonationState }>(
      'POST',
      '/admin/impersonate',
      { userId },
    );

    if (typeof window !== 'undefined') {
      // Keep the administrator's own token so exiting restores their session.
      if (this.token) {
        localStorage.setItem(IMPERSONATION_ADMIN_TOKEN_KEY, this.token);
      }
      localStorage.setItem(IMPERSONATION_STATE_KEY, JSON.stringify(response.impersonation));
      this.setToken(response.token);
      window.dispatchEvent(new CustomEvent('gidfine:impersonation-changed'));
    }

    return response;
  }

  async stopImpersonation(): Promise<void> {
    try {
      await this.request('POST', '/admin/impersonate/stop');
    } catch {
      // The session may already have expired or been revoked server-side.
    }

    if (typeof window === 'undefined') {
      this.token = null;
      return;
    }

    const adminToken = localStorage.getItem(IMPERSONATION_ADMIN_TOKEN_KEY);
    localStorage.removeItem(IMPERSONATION_STATE_KEY);
    localStorage.removeItem(IMPERSONATION_ADMIN_TOKEN_KEY);

    if (adminToken) {
      this.setToken(adminToken);
    } else {
      this.logout();
    }
    window.dispatchEvent(new CustomEvent('gidfine:impersonation-changed'));
  }

  getImpersonationState(): ImpersonationState | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(IMPERSONATION_STATE_KEY);
    if (!raw) return null;

    try {
      const state = JSON.parse(raw) as ImpersonationState;
      // expiresAt is in seconds; compare in milliseconds.
      if (!state?.expiresAt || state.expiresAt * 1000 <= Date.now()) {
        localStorage.removeItem(IMPERSONATION_STATE_KEY);
        localStorage.removeItem(IMPERSONATION_ADMIN_TOKEN_KEY);
        return null;
      }
      return state;
    } catch {
      localStorage.removeItem(IMPERSONATION_STATE_KEY);
      return null;
    }
  }

  isImpersonating(): boolean {
    return this.getImpersonationState() !== null;
  }

}

// Export singleton instance
export const gidfineAPI = new GidfineAPI();

// For backward compatibility, export the instance as `api`
export const api = gidfineAPI;

// Currency & Rate Conversion Helpers
export function ghsToPesewas(amountGhs: number): number {
  if (isNaN(amountGhs) || amountGhs <= 0) {
    throw new Error('Invalid amount: Must be a positive number.');
  }
  return Math.round(amountGhs * 100);
}

export function pesewasToGhs(pesewas: number): number {
  return pesewas / 100;
}

export function pesewasToGhsString(pesewas: number): string {
  return `GH₵ ${(pesewas / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function bpsToPercentString(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
