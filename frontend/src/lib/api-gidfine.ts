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
    email: string;
    first_name?: string;
    last_name?: string;
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
  error: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
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

    const response = await fetch(url, options);

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = (await response.json()) as ErrorResponse;
      throw new Error(errorData.error || 'API request failed');
    }

    return response.json();
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

  async register(email: string, password: string, firstName?: string, lastName?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('POST', '/auth/register', {
      email,
      password,
      first_name: firstName,
      last_name: lastName,
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
    const response = await this.request('GET', '/borrower/applications');
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
    const response = await this.request('GET', '/borrower/loans');
    return response.results || response;
  }

  async getLoanDetails(loanId: string): Promise<any> {
    return this.request('GET', `/loans/${loanId}`);
  }

  async getRepaymentSchedule(loanId: string): Promise<any[]> {
    const response = await this.request('GET', `/loans/${loanId}/schedule`);
    return response.results || response;
  }

  async getPaymentTransactions(loanId: string): Promise<any[]> {
    const response = await this.request('GET', `/loans/${loanId}/transactions`);
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
