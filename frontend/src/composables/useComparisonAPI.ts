/**
 * useComparisonAPI - Composable for loan comparison API interactions (Vue 3)
 */

import { ref } from 'vue';
import { API_BASE } from '../lib/config';
import type {
  GetLoansRequest,
  GetLoansResponse,
  SelectLoanRequest,
  SelectLoanResponse,
  WhatIfRequest,
  WhatIfResponse,
  LendersInfo,
} from '../types/comparison';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || (import.meta.env.REACT_APP_API_URL as string) || API_BASE;

export function useComparisonAPI() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const comparisonResult = ref<GetLoansResponse | null>(null);
  const selectedLender = ref<string | null>(null);
  const whatIfResult = ref<WhatIfResponse | null>(null);

  // Fetch loans comparison
  const getLoans = async (request: GetLoansRequest): Promise<GetLoansResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/api/comparison/get-loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch loans');
      }

      const data: GetLoansResponse = await response.json();
      comparisonResult.value = data;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Select loan
  const selectLoan = async (request: SelectLoanRequest): Promise<SelectLoanResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/api/comparison/select-loan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to select loan');
      }

      const data: SelectLoanResponse = await response.json();
      if (data.success) {
        selectedLender.value = request.selected_lender_id;
      }
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // What-if simulation
  const runWhatIf = async (request: WhatIfRequest): Promise<WhatIfResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/api/comparison/what-if`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to run simulation');
      }

      const data: WhatIfResponse = await response.json();
      whatIfResult.value = data;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Check available lenders
  const checkLenders = async (): Promise<LendersInfo> => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${API_BASE_URL}/api/comparison/lenders`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch lenders');
      }

      const data: LendersInfo = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const clearError = () => {
    error.value = null;
  };

  const resetComparison = () => {
    comparisonResult.value = null;
    selectedLender.value = null;
    whatIfResult.value = null;
    error.value = null;
  };

  return {
    loading,
    error,
    comparisonResult,
    selectedLender,
    whatIfResult,
    getLoans,
    selectLoan,
    runWhatIf,
    checkLenders,
    clearError,
    resetComparison,
  };
}

export default useComparisonAPI;
