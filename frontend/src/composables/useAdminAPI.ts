/**
 * useAdminAPI - Composable for admin API interactions (Vue 3)
 */

import { ref } from 'vue';
import { API_BASE } from '../lib/config';
import type {
  AdminStatsOverviewResponse,
  LendersListResponse,
  LenderInfoRequest,
  LenderInfoResponse,
  ReportRequest,
  ReportResponse,
  PerformanceMetricsResponse,
  AdminTrendsResponse,
  AdminHealthResponse,
  ConversionFunnelMetrics,
  LoanAnalyticsResponse,
  SystemInfoResponse,
} from '../types/admin';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || (import.meta.env.REACT_APP_API_URL as string) || API_BASE;

export function useAdminAPI() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ========================================================================
  // Statistics & Overview
  // ========================================================================

  const getStatsOverview = async (days: number = 30): Promise<AdminStatsOverviewResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(
        `${API_BASE_URL}/admin/stats/overview?days=${days}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch overview');
      }

      const data: AdminStatsOverviewResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getLoanAnalytics = async (days: number = 30): Promise<LoanAnalyticsResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(
        `${API_BASE_URL}/admin/stats/loans?days=${days}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch loan analytics');
      }

      const data: LoanAnalyticsResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getConversionFunnel = async (): Promise<ConversionFunnelMetrics> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/stats/conversion`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch conversion funnel');
      }

      const data: ConversionFunnelMetrics = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ========================================================================
  // Lender Management
  // ========================================================================

  const listLenders = async (): Promise<LendersListResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/lenders`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch lenders');
      }

      const data: LendersListResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getLender = async (lenderId: string): Promise<LenderInfoResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/lenders/${lenderId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch lender');
      }

      const data: LenderInfoResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createLender = async (request: LenderInfoRequest): Promise<LenderInfoResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/lenders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create lender');
      }

      const data: LenderInfoResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateLender = async (
    lenderId: string,
    request: LenderInfoRequest
  ): Promise<LenderInfoResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/lenders/${lenderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update lender');
      }

      const data: LenderInfoResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteLender = async (lenderId: string): Promise<boolean> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/lenders/${lenderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete lender');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ========================================================================
  // Performance & Trends
  // ========================================================================

  const getPerformanceMetrics = async (days: number = 30): Promise<PerformanceMetricsResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(
        `${API_BASE_URL}/admin/performance?days=${days}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch performance metrics');
      }

      const data: PerformanceMetricsResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getTrends = async (days: number = 30): Promise<AdminTrendsResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(
        `${API_BASE_URL}/admin/trends?days=${days}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch trends');
      }

      const data: AdminTrendsResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ========================================================================
  // Reporting
  // ========================================================================

  const generateReport = async (request: ReportRequest): Promise<ReportResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate report');
      }

      const data: ReportResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getReport = async (reportId: string): Promise<any> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/reports/${reportId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch report');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const downloadReport = async (reportId: string, format: string): Promise<any> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(
        `${API_BASE_URL}/admin/reports/${reportId}/download?format=${format}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to download report');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ========================================================================
  // System
  // ========================================================================

  const healthCheck = async (): Promise<AdminHealthResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Health check failed');
      }

      const data: AdminHealthResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getSystemInfo = async (): Promise<SystemInfoResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/admin/system/info`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch system info');
      }

      const data: SystemInfoResponse = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ========================================================================
  // Utilities
  // ========================================================================

  const clearError = () => {
    error.value = null;
  };

  const reset = () => {
    error.value = null;
    loading.value = false;
  };

  return {
    loading,
    error,
    getStatsOverview,
    getLoanAnalytics,
    getConversionFunnel,
    listLenders,
    getLender,
    createLender,
    updateLender,
    deleteLender,
    getPerformanceMetrics,
    getTrends,
    generateReport,
    getReport,
    downloadReport,
    healthCheck,
    getSystemInfo,
    clearError,
    reset,
  };
}

export default useAdminAPI;
