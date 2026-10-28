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

interface ApiEnvelope<T> {
  ok?: boolean;
  data?: T;
  error?: ErrorResponse['error'];
  requestId?: string;
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
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add authorization header if token exists
    if (this.token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${this.token}`,
      };
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch {
      throw new Error('Unable to reach the login service. Please try again in a moment.');
    }

    // Handle non-OK responses
    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const errorData = (await response.json()) as Partial<ErrorResponse>;
        throw new Error(errorData.error?.message || 'API request failed');
      }
      throw new Error('The login service returned an invalid response. Please try again later.');
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('The login service is not configured for this site yet.');
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
    }
  }

  // ============================================
  // BORROWER PROFILE
  // ============================================

  async getBorrowerProfile(): Promise<any> {
    return this.request('GET', '/borrower/profile');
  }

  async updateBorrowerProfile(profileData: {
    first_name?: string;
    last_name?: string;
    employer?: string;
    monthly_salary_pesewas?: number;
  }): Promise<any> {
    return this.request('PUT', '/borrower/profile', profileData);
  }

  // ============================================
  // APPLICATIONS
  // ============================================

  async listApplications(): Promise<any[]> {
    const response = (await this.request('GET', '/borrower/applications')) as any;
    return response.results || response;
  }

  async createApplication(data: {
    amount_requested_pesewas: number;
    tenure_months: number;
    purpose: string;
  }): Promise<any> {
    return this.request('POST', '/borrower/applications', data);
  }

  async submitApplication(applicationId: string): Promise<any> {
    return this.request('POST', `/borrower/applications/${applicationId}/submit`, {});
  }

  // ============================================
  // LOANS
  // ============================================

  async listLoans(): Promise<any[]> {
    const response = (await this.request('GET', '/borrower/loans')) as any;
    return response.results || response;
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
}

// Export singleton instance
export const gidfineAPI = new GidfineAPI();

// For backward compatibility, export the instance as `api`
export const api = gidfineAPI;
