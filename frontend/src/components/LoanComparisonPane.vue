<template>
  <!-- Loading State -->
  <div v-if="viewMode === 'loading'" class="flex items-center justify-center py-12">
    <div class="text-center">
      <div class="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-700 font-semibold">Comparing loans from 5 lenders...</p>
      <p class="text-gray-500 text-sm mt-2">This takes just a moment</p>
    </div>
  </div>

  <!-- Error State -->
  <div v-else-if="viewMode === 'error' || error" class="bg-red-50 border-2 border-red-200 rounded-lg p-6">
    <h3 class="text-lg font-bold text-red-900 mb-2">Comparison Failed</h3>
    <p class="text-red-700 mb-4">{{ error || 'An unexpected error occurred' }}</p>
    <button
      @click="fetchLoans"
      class="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700"
    >
      Try Again
    </button>
  </div>

  <!-- What-If View -->
  <WhatIfSimulator
    v-else-if="viewMode === 'what-if'"
    :current-amount="loanAmount"
    :current-tenure="tenureMonths"
    :session-id="sessionId"
    :on-simulate="handleRunWhatIf"
    :is-loading="loading"
    :on-close="() => (viewMode = 'comparison')"
  />

  <!-- Comparison Results View -->
  <LoanComparisonResults
    v-else-if="comparisonResult"
    :result="comparisonResult"
    :is-loading="loading"
    :on-select-loan="handleSelectLoan"
    :on-show-what-if="() => (viewMode = 'what-if')"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useComparisonAPI } from '../composables/useComparisonAPI';
import LoanComparisonResults from './LoanComparisonResults.vue';
import WhatIfSimulator from './WhatIfSimulator.vue';
import type { GetLoansRequest } from '../types/comparison';

const props = withDefaults(
  defineProps<{
    loanAmount: number;
    tenureMonths: number;
    creditScore: number;
    monthlySalary: number;
    age?: number;
    existingObligations?: number;
    onLoanSelected?: (lenderId: string, selectedData: any) => void;
    onComparingChanged?: (isComparing: boolean) => void;
  }>(),
  {
    age: 35,
    existingObligations: 0,
  }
);

type ViewMode = 'loading' | 'comparison' | 'what-if' | 'error';

const {
  loading,
  error,
  comparisonResult,
  runWhatIf,
  getLoans,
  selectLoan,
} = useComparisonAPI();

const viewMode = ref<ViewMode>('loading');
const sessionId = ref<string>('');

const fetchLoans = async () => {
  try {
    viewMode.value = 'loading';
    props.onComparingChanged?.(true);

    const request: GetLoansRequest = {
      loan_amount: props.loanAmount,
      tenure_months: props.tenureMonths,
      credit_score: props.creditScore,
      monthly_salary: props.monthlySalary,
      age: props.age,
      existing_obligations: props.existingObligations,
    };

    await getLoans(request);
    sessionId.value = `session_${Date.now()}`;
    viewMode.value = 'comparison';
  } catch (err) {
    viewMode.value = 'error';
  } finally {
    props.onComparingChanged?.(false);
  }
};

const handleSelectLoan = async (lenderId: string) => {
  try {
    const response = await selectLoan({
      session_id: sessionId.value,
      selected_lender_id: lenderId,
    });

    if (response.success) {
      props.onLoanSelected?.(lenderId, {
        lenderName: response.selected_lender,
        interestRate: response.selected_interest_rate,
        emi: response.selected_emi,
        nextStep: response.next_step,
      });
    }
  } catch (err) {
    console.error('Failed to select loan:', err);
    throw err;
  }
};

const handleRunWhatIf = async (newAmount?: number, newTenure?: number) => {
  return runWhatIf({
    session_id: sessionId.value,
    new_loan_amount: newAmount,
    new_tenure_months: newTenure,
  });
};

onMounted(() => {
  fetchLoans();
});

watch(
  () => [props.loanAmount, props.tenureMonths, props.creditScore, props.monthlySalary, props.age, props.existingObligations],
  () => {
    fetchLoans();
  }
);
</script>
