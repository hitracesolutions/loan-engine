<template>
  <div class="overflow-x-auto rounded-lg border border-gray-200">
    <table class="w-full">
      <!-- Header -->
      <thead class="bg-gradient-to-r from-gray-50 to-gray-100">
        <tr>
          <th class="px-4 py-3 text-left border-b border-gray-200">
            <div class="text-xs font-semibold text-gray-700">Lender</div>
          </th>
          <th class="px-4 py-3 text-left border-b border-gray-200">
            <button
              class="px-2 py-1 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors rounded"
              @click="handleSort('interest_rate')"
            >
              Interest Rate
              <span v-if="sortKey === 'interest_rate'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </button>
          </th>
          <th class="px-4 py-3 text-left border-b border-gray-200">
            <button
              class="px-2 py-1 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors rounded"
              @click="handleSort('emi')"
            >
              Monthly EMI
              <span v-if="sortKey === 'emi'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </button>
          </th>
          <th class="px-4 py-3 text-left border-b border-gray-200">
            <button
              class="px-2 py-1 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors rounded"
              @click="handleSort('total_cost')"
            >
              Total Cost
              <span v-if="sortKey === 'total_cost'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </button>
          </th>
          <th class="px-4 py-3 text-left border-b border-gray-200">
            <button
              class="px-2 py-1 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors rounded"
              @click="handleSort('approval_percentage')"
            >
              Approval %
              <span v-if="sortKey === 'approval_percentage'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </button>
          </th>
          <th class="px-4 py-3 text-left border-b border-gray-200">
            <button
              class="px-2 py-1 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors rounded"
              @click="handleSort('composite_score')"
            >
              Score
              <span v-if="sortKey === 'composite_score'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </button>
          </th>
          <th class="px-4 py-3 text-left border-b border-gray-200">
            <div class="text-xs font-semibold text-gray-700">Action</div>
          </th>
        </tr>
      </thead>

      <!-- Body -->
      <tbody class="divide-y divide-gray-200">
        <tr v-if="sortedLoans.length === 0">
          <td colspan="7" class="px-4 py-8 text-center text-gray-500">
            No loans to display
          </td>
        </tr>
        <tr
          v-else
          v-for="loan in sortedLoans"
          :key="loan.lender_id"
          :class="[
            'transition-colors',
            selectedLenderId === loan.lender_id
              ? 'bg-blue-50 border-l-4 border-l-blue-500'
              : 'hover:bg-gray-50',
            isLoading ? 'opacity-60' : ''
          ]"
        >
          <!-- Lender Name -->
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <div>
                <div class="font-semibold text-gray-900">{{ loan.lender_name }}</div>
                <div class="text-xs text-gray-500 capitalize">{{ loan.lender_type }}</div>
              </div>
              <span v-if="loan.rank_badge" class="text-lg" title="Rank">
                {{ loan.rank_badge }}
              </span>
            </div>
          </td>

          <!-- Interest Rate -->
          <td class="px-4 py-3">
            <span class="font-semibold text-gray-900">
              {{ loan.interest_rate.toFixed(2) }}%
            </span>
          </td>

          <!-- EMI -->
          <td class="px-4 py-3">
            <span class="font-semibold text-blue-600">
              ₹{{ loan.emi.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}
            </span>
          </td>

          <!-- Total Cost -->
          <td class="px-4 py-3">
            <span class="text-gray-900">
              ₹{{ loan.total_cost.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}
            </span>
          </td>

          <!-- Approval % -->
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-green-600">
                {{ loan.approval_percentage.toFixed(0) }}%
              </span>
              <div class="w-16 h-2 bg-gray-200 rounded-full">
                <div
                  class="h-2 bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                  :style="{ width: `${Math.min(loan.approval_percentage, 100)}%` }"
                />
              </div>
            </div>
          </td>

          <!-- Score -->
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="font-bold text-gray-900">
                {{ loan.composite_score.toFixed(1) }}/100
              </span>
              <div class="w-16 h-2 bg-gray-200 rounded-full">
                <div
                  class="h-2 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                  :style="{ width: `${Math.min(loan.composite_score, 100)}%` }"
                />
              </div>
            </div>
          </td>

          <!-- Select Button -->
          <td class="px-4 py-3">
            <button
              @click="$emit('select', loan.lender_id)"
              :disabled="isLoading"
              :class="[
                'px-3 py-1 rounded font-semibold text-sm transition-all',
                selectedLenderId === loan.lender_id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              ]"
            >
              {{ selectedLenderId === loan.lender_id ? '✓ Selected' : 'Select' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { LoanOffer } from '@/types/comparison';

type SortKey = 'interest_rate' | 'emi' | 'total_cost' | 'approval_percentage' | 'composite_score';
type SortOrder = 'asc' | 'desc';

const props = withDefaults(
  defineProps<{
    loans: LoanOffer[];
    selectedLenderId?: string;
    isLoading?: boolean;
  }>(),
  {
    isLoading: false,
  }
);

defineEmits<{
  (e: 'select', lenderId: string): void;
}>();

const sortKey = ref<SortKey>('composite_score');
const sortOrder = ref<SortOrder>('desc');

const handleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'desc';
  }
};

const sortedLoans = computed(() => {
  return [...props.loans].sort((a, b) => {
    const aVal = a[sortKey.value];
    const bVal = b[sortKey.value];

    let comparison = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortOrder.value === 'asc' ? comparison : -comparison;
  });
});
</script>
