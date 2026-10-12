<template>
  <div v-if="result.status === 'no_eligible_offers'" class="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
    <h3 class="text-lg font-bold text-yellow-900 mb-3">No Eligible Offers</h3>
    <p class="text-yellow-800 mb-4">
      Unfortunately, you don't meet the eligibility criteria for any lenders at this time.
    </p>

    <div v-if="result.smart_suggestions?.length > 0">
      <h4 class="font-semibold text-yellow-900 mb-2">Suggestions to improve eligibility:</h4>
      <ul class="list-disc list-inside space-y-1">
        <li v-for="(suggestion, idx) in result.smart_suggestions" :key="idx" class="text-yellow-800 text-sm">
          {{ suggestion }}
        </li>
      </ul>
    </div>
  </div>

  <div v-else class="space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Loan Comparison Results</h2>
          <p class="text-gray-700 mb-3">{{ result.recommendation_reason }}</p>
        </div>
        <!-- View Toggle -->
        <div class="flex gap-2">
          <button
            @click="viewMode = 'cards'"
            :class="[
              'px-4 py-2 rounded-lg font-semibold transition-colors',
              viewMode === 'cards'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            ]"
          >
            📋 Cards
          </button>
          <button
            @click="viewMode = 'table'"
            :class="[
              'px-4 py-2 rounded-lg font-semibold transition-colors',
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            ]"
          >
            📊 Table
          </button>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="([key, value], idx) in Object.entries(result.applied_weights || {})"
          :key="key"
          class="bg-white px-3 py-1 rounded text-sm text-gray-700"
        >
          {{ key.replace(/_/g, ' ') }}: {{ ((value as number) * 100).toFixed(0) }}%
        </span>
      </div>
    </div>

    <!-- Table View -->
    <div v-if="viewMode === 'table' && result.eligible_offers?.length > 0">
      <LoanComparisonTable
        :loans="result.eligible_offers"
        :selected-lender-id="selectedLender || undefined"
        :is-loading="submitting"
        @select="handleSelectLoan"
      />
    </div>

    <!-- Card View -->
    <template v-if="viewMode === 'cards'">
      <!-- Best Offer -->
      <div v-if="result.best_offer">
        <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span>🏆</span> Our Recommendation
        </h3>
        <LoanCard
          :loan="result.best_offer"
          :is-selected="selectedLender === result.best_offer.lender_id"
          :is-best="true"
          :is-loading="submitting"
          @select="handleSelectLoan"
        />
      </div>

      <!-- Eligible Offers -->
      <div v-if="result.eligible_offers?.length > 1">
        <h3 class="text-lg font-bold text-gray-900 mb-3">Other Eligible Options</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <template v-for="loan in result.eligible_offers" :key="loan.lender_id">
            <LoanCard
              v-if="!result.best_offer || loan.lender_id !== result.best_offer.lender_id"
              :loan="loan"
              :is-selected="selectedLender === loan.lender_id"
              :is-loading="submitting"
              @select="handleSelectLoan"
            />
          </template>
        </div>
      </div>

      <!-- Alternatives Summary -->
      <div v-if="result.alternatives?.length > 0" class="bg-blue-50 p-4 rounded-lg">
        <h4 class="font-semibold text-gray-900 mb-2">📊 Top Alternatives</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="alt in result.alternatives"
            :key="alt.lender_id"
            class="flex justify-between items-center bg-white p-3 rounded"
          >
            <div>
              <p class="font-semibold text-gray-900">{{ alt.lender_name }}</p>
              <p class="text-sm text-gray-600">
                {{ alt.interest_rate.toFixed(2) }}% • ₹{{ alt.emi.toLocaleString('en-IN') }}
              </p>
            </div>
            <span class="text-lg">{{ alt.rank_badge }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Error Message -->
    <div v-if="submitError" class="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
      <span class="text-red-600 text-xl">⚠️</span>
      <div>
        <p class="font-semibold text-red-900">Selection Error</p>
        <p class="text-red-700 text-sm">{{ submitError }}</p>
      </div>
    </div>

    <!-- Selection Status -->
    <div v-if="submitting" class="bg-blue-50 p-4 rounded-lg flex items-center gap-3">
      <div class="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
      <p class="text-blue-900 font-medium">Processing your selection...</p>
    </div>

    <!-- What-If Button -->
    <div class="flex justify-center">
      <button
        @click="$emit('showWhatIf')"
        class="bg-white border-2 border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition-colors"
      >
        💡 Try What-If Simulation
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { GetLoansResponse } from '@/types/comparison';
import LoanCard from './LoanCard.vue';
import LoanComparisonTable from './LoanComparisonTable.vue';

const props = defineProps<{
  result: GetLoansResponse;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'selectLoan', lenderId: string): void;
  (e: 'showWhatIf'): void;
}>();

const selectedLender = ref<string | null>(null);
const submitting = ref(false);
const submitError = ref<string | null>(null);
const viewMode = ref<'cards' | 'table'>('cards');

const handleSelectLoan = async (lenderId: string) => {
  try {
    selectedLender.value = lenderId;
    submitting.value = true;
    submitError.value = null;
    emit('selectLoan', lenderId);
  } catch (err: any) {
    submitError.value = err?.message || 'Failed to select loan';
    selectedLender.value = null;
  } finally {
    submitting.value = false;
  }
};
</script>
