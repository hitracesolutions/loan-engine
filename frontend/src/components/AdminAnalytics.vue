<template>
  <div v-if="loading" class="flex justify-center py-20">
    <div class="text-center">
      <div class="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-700 font-semibold">Loading analytics...</p>
    </div>
  </div>

  <div v-else-if="error || !trends || !analytics" class="bg-red-50 border border-red-200 rounded-lg p-6">
    <p class="text-red-900 font-semibold">Failed to load analytics</p>
    <p class="text-red-700 text-sm">{{ error || 'No data available' }}</p>
  </div>

  <div v-else class="space-y-8">
    <h2 class="text-2xl font-bold text-gray-900">Analytics & Insights</h2>

    <!-- Tab Navigation -->
    <div class="bg-white rounded-lg shadow-lg border-b border-gray-200">
      <div class="flex">
        <button
          v-for="tab in (['trends', 'users', 'efficiency'] as const)"
          :key="tab"
          @click="activeTab = tab"
          class="flex-1 py-4 px-6 font-semibold capitalize transition-colors"
          :class="activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-700 hover:text-gray-900'"
        >
          <span v-if="tab === 'trends'">📈 Trends</span>
          <span v-else-if="tab === 'users'">👥 User Profiles</span>
          <span v-else-if="tab === 'efficiency'">⚡ Efficiency</span>
        </button>
      </div>
    </div>

    <!-- Trends Tab -->
    <div v-if="activeTab === 'trends'" class="space-y-6">
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="rounded-lg border-2 p-6 bg-blue-50 border-blue-200">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-1">Total Loans Compared</p>
              <p class="text-2xl font-bold text-gray-900">{{ trends.summary.total_loans.toLocaleString() }}</p>
            </div>
            <span class="text-3xl">📊</span>
          </div>
        </div>

        <div class="rounded-lg border-2 p-6 bg-green-50 border-green-200">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-1">Total Conversions</p>
              <p class="text-2xl font-bold text-gray-900">{{ trends.summary.total_conversions.toLocaleString() }}</p>
            </div>
            <span class="text-3xl">✓</span>
          </div>
        </div>

        <div class="rounded-lg border-2 p-6 bg-purple-50 border-purple-200">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-1">Avg Daily Loans</p>
              <p class="text-2xl font-bold text-gray-900">{{ trends.summary.avg_daily_loans.toFixed(0) }}</p>
            </div>
            <span class="text-3xl">📅</span>
          </div>
        </div>

        <div class="rounded-lg border-2 p-6 bg-yellow-50 border-yellow-200">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-1">Peak Day Loans</p>
              <p class="text-2xl font-bold text-gray-900">{{ trends.summary.peak_day_loans.toLocaleString() }}</p>
              <p class="text-xs text-gray-600 mt-1">{{ trends.summary.peak_day_loans_date }}</p>
            </div>
            <span class="text-3xl">🔥</span>
          </div>
        </div>
      </div>

      <!-- Trend Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Loans Compared Over Time -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Loans Compared Over Time</h3>
          <div class="space-y-2 mb-6">
            <div
              v-for="(val, idx) in trends.trends.loans_compared.slice(-7)"
              :key="idx"
              class="flex items-center gap-4"
            >
              <span class="text-xs text-gray-600 w-10">
                {{ trends.trends.dates[trends.trends.dates.length - 7 + idx] }}
              </span>
              <div class="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  class="h-full rounded-full flex items-center justify-center text-white text-xs font-bold"
                  :style="{
                    width: `${calculatePercentage(val, trends.trends.loans_compared)}%`,
                    background: 'rgb(59, 130, 246)',
                  }"
                >
                  <span v-if="calculatePercentage(val, trends.trends.loans_compared) > 20">{{ val.toFixed(0) }}</span>
                </div>
              </div>
              <span class="text-sm font-semibold text-gray-900 w-16 text-right">{{ val.toFixed(0) }}</span>
            </div>
          </div>
        </div>

        <!-- Conversion Rate Trend -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Conversion Rate Trend</h3>
          <div class="space-y-2 mb-6">
            <div
              v-for="(val, idx) in trends.trends.conversions.slice(-7)"
              :key="idx"
              class="flex items-center gap-4"
            >
              <span class="text-xs text-gray-600 w-10">
                {{ trends.trends.dates[trends.trends.dates.length - 7 + idx] }}
              </span>
              <div class="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  class="h-full rounded-full flex items-center justify-center text-white text-xs font-bold"
                  :style="{
                    width: `${calculatePercentage(val, trends.trends.conversions)}%`,
                    background: 'rgb(34, 197, 94)',
                  }"
                >
                  <span v-if="calculatePercentage(val, trends.trends.conversions) > 20">{{ val.toFixed(0) }}</span>
                </div>
              </div>
              <span class="text-sm font-semibold text-gray-900 w-16 text-right">{{ val.toFixed(0) }}</span>
            </div>
          </div>
        </div>

        <!-- Average EMI Offered -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Average EMI Offered</h3>
          <div class="space-y-2 mb-6">
            <div
              v-for="(val, idx) in trends.trends.avg_emi.slice(-7)"
              :key="idx"
              class="flex items-center gap-4"
            >
              <span class="text-xs text-gray-600 w-10">
                {{ trends.trends.dates[trends.trends.dates.length - 7 + idx] }}
              </span>
              <div class="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  class="h-full rounded-full flex items-center justify-center text-white text-xs font-bold"
                  :style="{
                    width: `${calculatePercentage(val, trends.trends.avg_emi)}%`,
                    background: 'rgb(168, 85, 247)',
                  }"
                >
                  <span v-if="calculatePercentage(val, trends.trends.avg_emi) > 20">₹{{ val.toFixed(0) }}</span>
                </div>
              </div>
              <span class="text-sm font-semibold text-gray-900 w-16 text-right">₹{{ val.toFixed(0) }}</span>
            </div>
          </div>
        </div>

        <!-- Average Interest Rate -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Average Interest Rate</h3>
          <div class="space-y-2 mb-6">
            <div
              v-for="(val, idx) in trends.trends.avg_rate.slice(-7)"
              :key="idx"
              class="flex items-center gap-4"
            >
              <span class="text-xs text-gray-600 w-10">
                {{ trends.trends.dates[trends.trends.dates.length - 7 + idx] }}
              </span>
              <div class="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  class="h-full rounded-full flex items-center justify-center text-white text-xs font-bold"
                  :style="{
                    width: `${calculatePercentage(val, trends.trends.avg_rate)}%`,
                    background: 'rgb(239, 68, 68)',
                  }"
                >
                  <span v-if="calculatePercentage(val, trends.trends.avg_rate) > 20">{{ val.toFixed(2) }}%</span>
                </div>
              </div>
              <span class="text-sm font-semibold text-gray-900 w-16 text-right">{{ val.toFixed(2) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed Metrics Table -->
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Detailed Metrics</h3>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b-2 border-gray-300">
                <th class="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th class="text-right py-3 px-4 font-semibold text-gray-700">Loans</th>
                <th class="text-right py-3 px-4 font-semibold text-gray-700">Conversions</th>
                <th class="text-right py-3 px-4 font-semibold text-gray-700">Avg EMI</th>
                <th class="text-right py-3 px-4 font-semibold text-gray-700">Avg Rate</th>
                <th class="text-right py-3 px-4 font-semibold text-gray-700">Approvals</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(date, index) in trends.trends.dates"
                :key="date"
                class="border-b border-gray-200 hover:bg-gray-50"
              >
                <td class="py-3 px-4 text-gray-900">{{ date }}</td>
                <td class="text-right py-3 px-4 text-gray-900">{{ trends.trends.loans_compared[index] }}</td>
                <td class="text-right py-3 px-4 text-green-600 font-semibold">{{ trends.trends.conversions[index] }}</td>
                <td class="text-right py-3 px-4 text-gray-900">₹{{ trends.trends.avg_emi[index].toLocaleString() }}</td>
                <td class="text-right py-3 px-4 text-gray-900">{{ trends.trends.avg_rate[index].toFixed(2) }}%</td>
                <td class="text-right py-3 px-4 text-gray-900">{{ (trends.trends.avg_approval[index] * 100).toFixed(1) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Users Tab -->
    <div v-else-if="activeTab === 'users'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-2">Average Loan Amount</p>
              <p class="text-2xl font-bold text-gray-900">₹{{ analytics.user_profile_stats.avg_loan_amount.toLocaleString() }}</p>
            </div>
            <span class="text-3xl">💰</span>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-2">Average Tenure</p>
              <p class="text-2xl font-bold text-gray-900">{{ analytics.user_profile_stats.avg_tenure }} months</p>
            </div>
            <span class="text-3xl">📅</span>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-2">Average Salary</p>
              <p class="text-2xl font-bold text-gray-900">₹{{ analytics.user_profile_stats.avg_salary.toLocaleString() }}</p>
            </div>
            <span class="text-3xl">💵</span>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-2">Average Credit Score</p>
              <p class="text-2xl font-bold text-gray-900">{{ analytics.user_profile_stats.avg_credit_score }}</p>
            </div>
            <span class="text-3xl">📊</span>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-2">Average Obligations</p>
              <p class="text-2xl font-bold text-gray-900">₹{{ analytics.user_profile_stats.avg_obligations.toLocaleString() }}</p>
            </div>
            <span class="text-3xl">⚖️</span>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-gray-600 text-sm font-semibold mb-2">Average Age</p>
              <p class="text-2xl font-bold text-gray-900">{{ analytics.user_profile_stats.avg_age }} years</p>
            </div>
            <span class="text-3xl">👤</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Efficiency Tab -->
    <div v-else-if="activeTab === 'efficiency'" class="space-y-6">
      <div class="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-8">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-700 font-semibold text-lg mb-2">Overall Efficiency Score</p>
            <p class="text-gray-600">Based on interest rates, EMI, and approval probabilities</p>
          </div>
          <div class="text-center">
            <p class="text-6xl font-bold text-green-600">{{ efficiencyData.overallScore.toFixed(1) }}</p>
            <p class="text-green-700 font-semibold mt-2">/100</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="rounded-lg bg-blue-100 p-6">
          <p class="font-semibold text-blue-900 mb-2">Interest Rate Efficiency</p>
          <p class="text-3xl font-bold text-gray-900 mb-3">{{ efficiencyData.rateScore.toFixed(1) }}</p>
          <div class="bg-gray-300 rounded-full h-3 mb-3 overflow-hidden">
            <div class="bg-blue-500 h-3" :style="{ width: `${Math.min(efficiencyData.rateScore, 100)}%` }"></div>
          </div>
          <p class="text-sm text-blue-900">Avg Rate: {{ efficiencyData.avgRate.toFixed(2) }}%</p>
        </div>

        <div class="rounded-lg bg-purple-100 p-6">
          <p class="font-semibold text-purple-900 mb-2">EMI Efficiency</p>
          <p class="text-3xl font-bold text-gray-900 mb-3">{{ efficiencyData.emiScore.toFixed(1) }}</p>
          <div class="bg-gray-300 rounded-full h-3 mb-3 overflow-hidden">
            <div class="bg-purple-500 h-3" :style="{ width: `${Math.min(efficiencyData.emiScore, 100)}%` }"></div>
          </div>
          <p class="text-sm text-purple-900">Avg EMI: ₹{{ efficiencyData.avgEMI.toLocaleString() }}</p>
        </div>

        <div class="rounded-lg bg-green-100 p-6">
          <p class="font-semibold text-green-900 mb-2">Approval Efficiency</p>
          <p class="text-3xl font-bold text-gray-900 mb-3">{{ efficiencyData.approvalScore.toFixed(1) }}</p>
          <div class="bg-gray-300 rounded-full h-3 mb-3 overflow-hidden">
            <div class="bg-green-500 h-3" :style="{ width: `${Math.min(efficiencyData.approvalScore, 100)}%` }"></div>
          </div>
          <p class="text-sm text-green-900">Avg Approval: {{ (efficiencyData.avgApproval * 100).toFixed(1) }}%</p>
        </div>
      </div>

      <div class="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h3 class="text-lg font-bold text-blue-900 mb-4">💡 Efficiency Insights</h3>
        <ul class="space-y-3 text-blue-900">
          <li class="flex items-start gap-3">
            <span class="text-xl">📊</span>
            <span>
              <strong>Interest Rates:</strong> The average interest rate is {{ efficiencyData.avgRate.toFixed(2) }}%,
              which is {{ efficiencyData.avgRate < 8.5 ? 'below' : 'above' }} market average.
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span class="text-xl">💰</span>
            <span>
              <strong>EMI Amounts:</strong> Average EMI of ₹{{ efficiencyData.avgEMI.toLocaleString() }} shows
              {{ efficiencyData.avgEMI < 12000 ? ' competitive' : ' reasonable' }} loan sizing.
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span class="text-xl">✅</span>
            <span>
              <strong>Approval Rate:</strong> {{ (efficiencyData.avgApproval * 100).toFixed(1) }}% average approval
              probability indicates {{ efficiencyData.avgApproval > 0.85 ? 'excellent' : efficiencyData.avgApproval > 0.75 ? 'good' : 'moderate' }} credit risk management.
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminAPI } from '../composables/useAdminAPI';
import type { AdminTrendsResponse, LoanAnalyticsResponse } from '../types/admin';

const props = defineProps<{
  periodDays: number;
}>();

const { getTrends, getLoanAnalytics, loading, error } = useAdminAPI();
const trends = ref<AdminTrendsResponse | null>(null);
const analytics = ref<LoanAnalyticsResponse | null>(null);
const activeTab = ref<'trends' | 'users' | 'efficiency'>('trends');

const calculatePercentage = (val: number, list: number[]) => {
  const min = Math.min(...list);
  const max = Math.max(...list);
  const range = max - min || 1;
  const pct = ((val - min) / range) * 100;
  return Math.max(Math.min(pct, 100), 5);
};

const efficiencyData = computed(() => {
  if (!trends.value) {
    return {
      avgRate: 0,
      avgEMI: 0,
      avgApproval: 0,
      rateScore: 0,
      emiScore: 0,
      approvalScore: 0,
      overallScore: 0,
    };
  }

  const { avg_rate, avg_emi, avg_approval } = trends.value.trends;
  const avgRate = avg_rate.reduce((a: number, b: number) => a + b, 0) / (avg_rate.length || 1);
  const avgEMI = avg_emi.reduce((a: number, b: number) => a + b, 0) / (avg_emi.length || 1);
  const avgApproval = avg_approval.reduce((a: number, b: number) => a + b, 0) / (avg_approval.length || 1);

  const minRate = Math.min(...avg_rate);
  const maxRate = Math.max(...avg_rate);
  const minEMI = Math.min(...avg_emi);
  const maxEMI = Math.max(...avg_emi);

  const rateScore = maxRate === minRate ? 100 : ((maxRate - avgRate) / (maxRate - minRate)) * 100;
  const emiScore = maxEMI === minEMI ? 100 : ((maxEMI - avgEMI) / (maxEMI - minEMI)) * 100;
  const approvalScore = avgApproval * 100;
  const overallScore = rateScore * 0.3 + emiScore * 0.3 + approvalScore * 0.4;

  return {
    avgRate,
    avgEMI,
    avgApproval,
    rateScore,
    emiScore,
    approvalScore,
    overallScore,
  };
});

const fetchData = async () => {
  try {
    const [trendsData, analyticsData] = await Promise.all([
      getTrends(props.periodDays),
      getLoanAnalytics(props.periodDays),
    ]);
    trends.value = trendsData;
    analytics.value = analyticsData;
  } catch (err) {
    console.error('Failed to fetch analytics:', err);
  }
};

onMounted(() => {
  fetchData();
});

watch(
  () => props.periodDays,
  () => {
    fetchData();
  }
);
</script>
