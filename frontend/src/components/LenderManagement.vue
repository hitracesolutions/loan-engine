<template>
  <div v-if="loading" class="flex justify-center py-20">
    <div class="text-center">
      <div class="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-700 font-semibold">Loading lenders...</p>
    </div>
  </div>

  <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6">
    <p class="text-red-900 font-semibold">Failed to load lenders</p>
    <p class="text-red-700 text-sm">{{ error }}</p>
  </div>

  <div v-else class="space-y-8">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">🏦 Lender Management</h2>
      <button
        @click="showForm = !showForm"
        class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
      >
        {{ showForm ? 'Cancel' : '+ Add New Lender' }}
      </button>
    </div>

    <!-- Lenders Table -->
    <div v-if="lenders" class="bg-white rounded-lg shadow-lg overflow-hidden">
      <div class="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
        <h3 class="text-lg font-bold text-gray-900">
          Active Lenders ({{ lenders.active_count }} of {{ lenders.total_count }})
        </h3>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b-2 border-gray-300 bg-gray-50">
              <th class="text-left py-3 px-6 font-semibold text-gray-700">Lender Name</th>
              <th class="text-right py-3 px-6 font-semibold text-gray-700">Selections</th>
              <th class="text-right py-3 px-6 font-semibold text-gray-700">Selection Rate</th>
              <th class="text-right py-3 px-6 font-semibold text-gray-700">Avg EMI</th>
              <th class="text-right py-3 px-6 font-semibold text-gray-700">Avg Rate</th>
              <th class="text-right py-3 px-6 font-semibold text-gray-700">Approval %</th>
              <th class="text-center py-3 px-6 font-semibold text-gray-700">Market Share</th>
              <th class="text-center py-3 px-6 font-semibold text-gray-700">Trend</th>
              <th class="text-center py-3 px-6 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="lender in lenders.lenders"
              :key="lender.lender_id"
              class="border-b border-gray-200 hover:bg-gray-50"
            >
              <td class="py-4 px-6">
                <div>
                  <p class="font-semibold text-gray-900">{{ lender.lender_name }}</p>
                  <p class="text-xs text-gray-600 capitalize">{{ lender.lender_id }}</p>
                </div>
              </td>
              <td class="text-right py-4 px-6 font-semibold text-gray-900">
                {{ lender.selections }}
              </td>
              <td class="text-right py-4 px-6 text-gray-900">
                {{ lender.selection_rate.toFixed(2) }}%
              </td>
              <td class="text-right py-4 px-6 font-semibold text-gray-900">
                ₹{{ lender.avg_emi_offered.toLocaleString() }}
              </td>
              <td class="text-right py-4 px-6 font-semibold text-gray-900">
                {{ lender.avg_rate.toFixed(2) }}%
              </td>
              <td class="text-right py-4 px-6 font-semibold text-green-600">
                {{ (lender.avg_approval_prob * 100).toFixed(0) }}%
              </td>
              <td class="text-center py-4 px-6">
                <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                  {{ lender.market_share.toFixed(1) }}%
                </span>
              </td>
              <td class="text-center py-4 px-6">
                <span
                  class="text-lg"
                  :class="{
                    'text-green-600': lender.trend === 'up',
                    'text-red-600': lender.trend === 'down',
                    'text-gray-600': lender.trend === 'stable',
                  }"
                >
                  <span v-if="lender.trend === 'up'">📈</span>
                  <span v-else-if="lender.trend === 'down'">📉</span>
                  <span v-else>➡️</span>
                </span>
              </td>
              <td class="text-center py-4 px-6">
                <button class="text-blue-600 hover:text-blue-900 font-semibold text-sm">
                  Edit
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAdminAPI } from '../composables/useAdminAPI';
import type { LendersListResponse } from '../types/admin';

const { listLenders, loading, error } = useAdminAPI();
const lenders = ref<LendersListResponse | null>(null);
const showForm = ref(false);

onMounted(async () => {
  try {
    const data = await listLenders();
    lenders.value = data;
  } catch (err) {
    console.error('Failed to fetch lenders:', err);
  }
});
</script>
