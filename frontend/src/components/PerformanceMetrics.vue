<template>
  <div v-if="loading || !metrics" class="flex justify-center py-20">
    <div class="text-center">
      <div class="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-700 font-semibold">Loading metrics...</p>
    </div>
  </div>

  <div v-else class="space-y-8">
    <h2 class="text-2xl font-bold text-gray-900">📊 Performance Metrics</h2>

    <!-- Key Metrics Overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Total Loans Compared</p>
            <p class="text-3xl font-bold text-gray-900 mt-2">{{ metrics.kpis.total_loans_compared }}</p>
            <p class="text-gray-500 text-xs mt-2">All time</p>
          </div>
          <div class="text-4xl opacity-50">📱</div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Conversion Rate</p>
            <p class="text-3xl font-bold text-gray-900 mt-2">{{ metrics.kpis.conversion_rate.toFixed(2) }}%</p>
            <p class="text-gray-500 text-xs mt-2">Current period</p>
          </div>
          <div class="text-4xl opacity-50">📈</div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Avg EMI Offered</p>
            <p class="text-3xl font-bold text-gray-900 mt-2">₹{{ metrics.kpis.avg_emi.toLocaleString() }}</p>
            <p class="text-gray-500 text-xs mt-2">System average</p>
          </div>
          <div class="text-4xl opacity-50">💰</div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Lenders Connected</p>
            <p class="text-3xl font-bold text-gray-900 mt-2">{{ metrics.lender_performance.length }}</p>
            <p class="text-gray-500 text-xs mt-2">Active partnerships</p>
          </div>
          <div class="text-4xl opacity-50">🏦</div>
        </div>
      </div>
    </div>

    <!-- Lender Performance -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-6">🏦 Top Performing Lenders</h3>
      <div class="space-y-4">
        <div
          v-for="lender in metrics.lender_performance.slice(0, 5)"
          :key="lender.lender_id"
          class="border border-gray-200 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-semibold text-gray-900">{{ lender.lender_name }}</h4>
            <span class="text-sm text-gray-600">{{ lender.selection_rate.toFixed(1) }}% rate</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${lender.selection_rate}%` }"
            ></div>
          </div>
          <div class="flex justify-between text-xs text-gray-600 mt-2">
            <span>{{ lender.selections }} selections</span>
            <span>Market Share: {{ lender.market_share.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Efficiency Scores -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-6">⭐ Efficiency Scores</h3>
      <div class="space-y-4">
        <div
          v-for="score in metrics.efficiency_scores.slice(0, 5)"
          :key="score.lender_id"
          class="border border-gray-200 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-semibold text-gray-900">{{ score.lender_name }}</h4>
            <span class="text-lg font-bold text-blue-600">{{ score.efficiency_score.toFixed(1) }}</span>
          </div>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p class="text-gray-600">EMI Score</p>
              <p class="font-semibold text-gray-900">{{ score.emi_score.toFixed(1) }}</p>
            </div>
            <div>
              <p class="text-gray-600">Rate Score</p>
              <p class="font-semibold text-gray-900">{{ score.rate_score.toFixed(1) }}</p>
            </div>
            <div>
              <p class="text-gray-600">Approval Score</p>
              <p class="font-semibold text-gray-900">{{ score.approval_score.toFixed(1) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Performers -->
    <div
      v-if="metrics.top_performers.length > 0"
      class="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6"
    >
      <h3 class="text-lg font-bold text-gray-900 mb-4">🏆 Top Performers</h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(lender, idx) in metrics.top_performers"
          :key="idx"
          class="bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold text-sm"
        >
          #{{ idx + 1 }} {{ lender }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useAdminAPI } from '../composables/useAdminAPI';
import type { PerformanceMetricsResponse } from '../types/admin';

const props = withDefaults(
  defineProps<{
    periodDays?: number;
  }>(),
  {
    periodDays: 30,
  }
);

const { getPerformanceMetrics, loading } = useAdminAPI();
const metrics = ref<PerformanceMetricsResponse | null>(null);
let intervalId: any = null;

const fetchMetrics = async () => {
  try {
    const data = await getPerformanceMetrics(props.periodDays);
    metrics.value = data;
  } catch (err) {
    console.error('Failed to fetch metrics:', err);
  }
};

onMounted(() => {
  fetchMetrics();
  intervalId = setInterval(fetchMetrics, 5 * 60 * 1000);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});

watch(
  () => props.periodDays,
  () => {
    fetchMetrics();
  }
);
</script>
