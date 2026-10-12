<template>
  <div
    :class="[
      'relative rounded-lg border-2 transition-all duration-200 p-4',
      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
      isBest ? 'ring-2 ring-green-400' : '',
      isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    ]"
    @click="handleSelect"
  >
    <!-- Badge -->
    <div class="absolute -top-3 -right-3 flex gap-2">
      <span class="text-2xl">{{ loan.rank_badge }}</span>
      <span v-if="isBest" class="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
        BEST
      </span>
    </div>

    <!-- Header -->
    <div class="mb-4 pr-8">
      <h3 class="text-lg font-bold text-gray-900">{{ loan.lender_name }}</h3>
      <p class="text-sm text-gray-500 capitalize">{{ loan.lender_type }}</p>
    </div>

    <!-- Main Metrics -->
    <div class="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
      <div>
        <p class="text-xs text-gray-600 mb-1">Interest Rate</p>
        <p class="text-2xl font-bold text-gray-900">{{ loan.interest_rate.toFixed(2) }}%</p>
      </div>
      <div>
        <p class="text-xs text-gray-600 mb-1">Monthly EMI</p>
        <p class="text-2xl font-bold text-blue-600">
          ₹{{ loan.emi.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-gray-600 mb-1">Approval %</p>
        <p class="text-2xl font-bold text-green-600">{{ loan.approval_percentage.toFixed(0) }}%</p>
      </div>
    </div>

    <!-- Secondary Metrics -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-gray-50 p-2 rounded">
        <p class="text-xs text-gray-600">Total Cost</p>
        <p class="font-semibold text-gray-900">
          ₹{{ loan.total_cost.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}
        </p>
      </div>
      <div class="bg-gray-50 p-2 rounded">
        <p class="text-xs text-gray-600">Score</p>
        <p class="font-semibold text-gray-900">{{ loan.composite_score.toFixed(1) }}/100</p>
      </div>
    </div>

    <!-- Score Bar -->
    <div class="mb-4">
      <div class="flex justify-between items-center mb-1">
        <span class="text-xs font-semibold text-gray-700">Recommendation Score</span>
        <span class="text-xs text-gray-600">{{ loan.composite_score.toFixed(1) }}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
          :style="{ width: `${Math.min(loan.composite_score, 100)}%` }"
        />
      </div>
    </div>

    <!-- Selection Radio -->
    <div class="flex items-center justify-between pt-3 border-t border-gray-100">
      <input
        type="radio"
        :id="`loan-${loan.lender_id}`"
        name="loan-selection"
        :value="loan.lender_id"
        :checked="isSelected"
        @change="handleSelect"
        :disabled="isLoading"
        class="w-4 h-4 text-blue-600"
      />
      <label :for="`loan-${loan.lender_id}`" class="text-sm font-medium text-gray-700">
        Select this loan
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LoanOffer } from '@/types/comparison';

const props = withDefaults(
  defineProps<{
    loan: LoanOffer;
    isSelected: boolean;
    isBest?: boolean;
    isLoading?: boolean;
  }>(),
  {
    isBest: false,
    isLoading: false,
  }
);

const emit = defineEmits<{
  (e: 'select', lenderId: string): void;
}>();

const handleSelect = () => {
  if (!props.isLoading) {
    emit('select', props.loan.lender_id);
  }
};
</script>
