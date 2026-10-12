<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-900">💡 What-If Simulator</h2>
      <button
        v-if="onClose"
        @click="onClose"
        class="text-gray-500 hover:text-gray-700"
      >
        ✕
      </button>
    </div>

    <!-- Parameter Controls -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg">
      <!-- Loan Amount -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">
          Loan Amount
        </label>
        <div class="space-y-2">
          <input
            type="range"
            min="100000"
            max="5000000"
            step="50000"
            v-model.number="newAmount"
            :disabled="isLoading || simulating"
            class="w-full"
          />
          <div class="flex justify-between items-center">
            <span class="text-lg font-bold text-gray-900">
              ₹{{ newAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}
            </span>
            <span
              class="text-sm font-semibold"
              :class="amountChange > 0 ? 'text-red-600' : amountChange < 0 ? 'text-green-600' : 'text-gray-600'"
            >
              {{ amountChange > 0 ? '+' : '' }}{{ amountChange.toLocaleString('en-IN') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Tenure -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">
          Tenure (Months)
        </label>
        <div class="space-y-2">
          <input
            type="range"
            min="6"
            max="120"
            step="6"
            v-model.number="newTenure"
            :disabled="isLoading || simulating"
            class="w-full"
          />
          <div class="flex justify-between items-center">
            <span class="text-lg font-bold text-gray-900">{{ newTenure }} months</span>
            <span
              class="text-sm font-semibold"
              :class="tenureChange > 0 ? 'text-red-600' : tenureChange < 0 ? 'text-green-600' : 'text-gray-600'"
            >
              {{ tenureChange > 0 ? '+' : '' }}{{ tenureChange }} months
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-3">
      <button
        @click="handleSimulate"
        :disabled="simulating || isLoading || (newAmount === currentAmount && newTenure === currentTenure)"
        class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {{ simulating ? 'Simulating...' : 'Run Simulation' }}
      </button>
      <button
        v-if="onClose"
        @click="onClose"
        class="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
      >
        Close
      </button>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
      <span class="text-red-600 text-xl">⚠️</span>
      <div>
        <p class="font-semibold text-red-900">Simulation Failed</p>
        <p class="text-red-700 text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="space-y-4">
      <h3 class="text-lg font-bold text-gray-900">Simulation Results</h3>

      <!-- Comparison Table -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b-2 border-gray-300">
              <th class="text-left py-3 px-4 font-semibold text-gray-700">Parameter</th>
              <th class="text-right py-3 px-4 font-semibold text-gray-700">Original</th>
              <th class="text-right py-3 px-4 font-semibold text-gray-700">Simulated</th>
              <th class="text-right py-3 px-4 font-semibold text-gray-700">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-gray-200 hover:bg-gray-50">
              <td class="py-3 px-4 text-gray-900 font-semibold">Loan Amount</td>
              <td class="py-3 px-4 text-right text-gray-700">
                ₹{{ (result.original.loan_amount || 0).toLocaleString('en-IN') }}
              </td>
              <td class="py-3 px-4 text-right text-gray-700">
                ₹{{ (result.simulated.loan_amount || 0).toLocaleString('en-IN') }}
              </td>
              <td class="py-3 px-4 text-right">
                <span class="font-semibold text-gray-700">
                  <template v-if="result.simulated.loan_amount">
                    <span
                      v-if="result.simulated.loan_amount > result.original.loan_amount"
                      class="text-red-600"
                    >
                      +₹{{ ((result.simulated.loan_amount || 0) - (result.original.loan_amount || 0)).toLocaleString('en-IN') }}
                    </span>
                    <span v-else class="text-green-600">
                      -₹{{ ((result.original.loan_amount || 0) - (result.simulated.loan_amount || 0)).toLocaleString('en-IN') }}
                    </span>
                  </template>
                  <template v-else>-</template>
                </span>
              </td>
            </tr>
            <tr class="border-b border-gray-200 hover:bg-gray-50">
              <td class="py-3 px-4 text-gray-900 font-semibold">Tenure</td>
              <td class="py-3 px-4 text-right text-gray-700">{{ result.original.tenure_months }} months</td>
              <td class="py-3 px-4 text-right text-gray-700">{{ result.simulated.tenure_months }} months</td>
              <td class="py-3 px-4 text-right">
                <span class="font-semibold text-gray-700">
                  <span
                    v-if="result.simulated.tenure_months > result.original.tenure_months"
                    class="text-red-600"
                  >
                    +{{ result.simulated.tenure_months - result.original.tenure_months }} months
                  </span>
                  <span v-else class="text-green-600">
                    -{{ result.original.tenure_months - result.simulated.tenure_months }} months
                  </span>
                </span>
              </td>
            </tr>
            <tr class="hover:bg-gray-50">
              <td class="py-3 px-4 text-gray-900 font-semibold">EMI</td>
              <td class="py-3 px-4 text-right text-gray-700">₹{{ (result.original.emi || 0).toLocaleString('en-IN') }}</td>
              <td class="py-3 px-4 text-right text-gray-700">₹{{ (result.simulated.emi || 0).toLocaleString('en-IN') }}</td>
              <td class="py-3 px-4 text-right">
                <span class="font-semibold text-gray-700">
                  <template v-if="result.differences.emi_change">
                    <span v-if="result.differences.emi_change > 0" class="text-red-600">
                      +₹{{ result.differences.emi_change.toLocaleString('en-IN') }}
                    </span>
                    <span v-else class="text-green-600">
                      -₹{{ Math.abs(result.differences.emi_change).toLocaleString('en-IN') }}
                    </span>
                  </template>
                  <template v-else>-</template>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Summary -->
      <div v-if="result.differences.interest_savings !== undefined" class="bg-green-50 p-4 rounded-lg">
        <p class="text-sm text-gray-600">Interest Savings</p>
        <p class="text-2xl font-bold text-green-600">
          ₹{{ Math.abs(result.differences.interest_savings || 0).toLocaleString('en-IN') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { WhatIfResponse } from '../types/comparison';

const props = withDefaults(
  defineProps<{
    currentAmount: number;
    currentTenure: number;
    sessionId?: string;
    onSimulate: (newAmount?: number, newTenure?: number) => Promise<WhatIfResponse>;
    isLoading?: boolean;
    onClose?: () => void;
  }>(),
  {
    isLoading: false,
  }
);

const newAmount = ref(props.currentAmount);
const newTenure = ref(props.currentTenure);
const result = ref<WhatIfResponse | null>(null);
const error = ref<string | null>(null);
const simulating = ref(false);

watch(() => props.currentAmount, (val) => { newAmount.value = val; });
watch(() => props.currentTenure, (val) => { newTenure.value = val; });

const amountChange = computed(() => newAmount.value - props.currentAmount);
const tenureChange = computed(() => newTenure.value - props.currentTenure);

const handleSimulate = async () => {
  try {
    simulating.value = true;
    error.value = null;

    const response = await props.onSimulate(
      newAmount.value !== props.currentAmount ? newAmount.value : undefined,
      newTenure.value !== props.currentTenure ? newTenure.value : undefined
    );

    result.value = response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Simulation failed';
    error.value = message;
  } finally {
    simulating.value = false;
  }
};
</script>
