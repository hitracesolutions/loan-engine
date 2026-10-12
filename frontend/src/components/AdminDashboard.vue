<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Header -->
    <header class="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
      <div class="flex items-center justify-between px-8 py-4">
        <div>
          <h1 class="text-3xl font-bold">🎛️ Admin Dashboard</h1>
          <p class="text-blue-100 text-sm mt-1">Loan Marketplace Control Center</p>
        </div>
        <div class="flex items-center gap-6">
          <div class="text-right">
            <p class="font-semibold">{{ userName }}</p>
            <p class="text-sm text-blue-100 capitalize">{{ userRole }}</p>
          </div>
          <button
            v-if="onLogout"
            @click="onLogout"
            class="bg-blue-700 hover:bg-blue-900 px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <!-- Period Selector -->
      <div class="px-8 py-3 bg-blue-700 flex items-center gap-4">
        <label class="font-semibold">Period:</label>
        <select
          v-model="selectedPeriodDays"
          class="bg-blue-600 text-white px-4 py-2 rounded-lg border border-blue-500 focus:outline-none"
        >
          <option :value="7">Last 7 days</option>
          <option :value="14">Last 14 days</option>
          <option :value="30">Last 30 days</option>
          <option :value="60">Last 60 days</option>
          <option :value="90">Last 90 days</option>
          <option :value="180">Last 6 months</option>
          <option :value="365">Last year</option>
        </select>
      </div>
    </header>

    <!-- Main Content -->
    <div class="flex min-h-[calc(100vh-200px)]">
      <!-- Sidebar Navigation -->
      <nav class="w-64 bg-white shadow-lg relative">
        <div class="p-4 space-y-2">
          <button
            v-for="item in navigationItems"
            :key="item.id"
            @click="canAccessView(item.id) && (activeView = item.id)"
            :disabled="!canAccessView(item.id)"
            class="w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center"
            :class="[
              activeView === item.id
                ? 'bg-blue-600 text-white'
                : canAccessView(item.id)
                ? 'text-gray-700 hover:bg-gray-100'
                : 'text-gray-400 cursor-not-allowed'
            ]"
          >
            <span class="mr-3">{{ item.icon }}</span>
            <span class="flex-1">{{ item.label }}</span>
            <span v-if="!canAccessView(item.id)" class="text-xs">🔒</span>
          </button>
        </div>

        <!-- Sidebar Footer -->
        <div class="p-4 mt-8">
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p class="text-sm text-gray-700 font-semibold mb-2">💡 Tip:</p>
            <p class="text-xs text-gray-600">
              Use the period selector at the top to filter all analytics by date range.
            </p>
          </div>
        </div>
      </nav>

      <!-- Content Area -->
      <main class="flex-1 overflow-auto">
        <div class="p-8">
          <!-- Error Alert -->
          <div
            v-if="apiError"
            class="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg flex items-start gap-3"
          >
            <span class="text-red-600 text-2xl">⚠️</span>
            <div class="flex-1">
              <p class="font-bold text-red-900">API Error</p>
              <p class="text-red-700 text-sm">{{ apiError }}</p>
            </div>
            <button
              @click="clearError"
              class="text-red-600 hover:text-red-900 font-bold"
            >
              ✕
            </button>
          </div>

          <!-- View Components -->
          <!-- 1. Dashboard View -->
          <div v-if="activeView === 'dashboard'">
            <div v-if="overviewLoading" class="flex justify-center py-20">
              <div class="text-center">
                <div class="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p class="text-gray-700 font-semibold">Loading dashboard...</p>
              </div>
            </div>

            <div v-else-if="overviewError" class="bg-red-50 border border-red-200 rounded-lg p-6">
              <p class="text-red-900 font-semibold">Failed to load dashboard</p>
              <p class="text-red-700 text-sm">{{ overviewError }}</p>
            </div>

            <div v-else-if="overview" class="space-y-8">
              <h2 class="text-2xl font-bold text-gray-900">Dashboard Overview</h2>

              <!-- KPI Cards -->
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="rounded-lg border-2 p-6 bg-blue-50 border-blue-200 text-blue-900">
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="text-sm font-semibold opacity-75">Total Loans Compared</p>
                      <p class="text-2xl font-bold mt-2">{{ overview.kpis.total_loans_compared.toLocaleString() }}</p>
                    </div>
                    <span class="text-3xl">📊</span>
                  </div>
                </div>

                <div class="rounded-lg border-2 p-6 bg-green-50 border-green-200 text-green-900">
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="text-sm font-semibold opacity-75">Conversions</p>
                      <p class="text-2xl font-bold mt-2">{{ overview.kpis.conversions.toLocaleString() }}</p>
                      <p class="text-xs opacity-75 mt-1">{{ overview.kpis.conversion_rate.toFixed(1) }}% rate</p>
                    </div>
                    <span class="text-3xl">✓</span>
                  </div>
                </div>

                <div class="rounded-lg border-2 p-6 bg-purple-50 border-purple-200 text-purple-900">
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="text-sm font-semibold opacity-75">Avg EMI Offered</p>
                      <p class="text-2xl font-bold mt-2">₹{{ overview.kpis.avg_emi.toLocaleString() }}</p>
                    </div>
                    <span class="text-3xl">💰</span>
                  </div>
                </div>

                <div class="rounded-lg border-2 p-6 bg-yellow-50 border-yellow-200 text-yellow-900">
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="text-sm font-semibold opacity-75">Total Cost Savings</p>
                      <p class="text-2xl font-bold mt-2">₹{{ (overview.kpis.total_cost_savings / 1000000).toFixed(1) }}M</p>
                    </div>
                    <span class="text-3xl">💎</span>
                  </div>
                </div>
              </div>

              <!-- Conversion Funnel -->
              <div class="bg-white rounded-lg shadow-lg p-6">
                <h3 class="text-xl font-bold text-gray-900 mb-6">Conversion Funnel</h3>
                <div class="space-y-6">
                  <div v-for="stage in funnelStages" :key="stage.label">
                    <div class="flex justify-between items-center mb-2">
                      <span class="font-semibold text-gray-800">{{ stage.label }}</span>
                      <div class="text-right">
                        <span class="font-bold text-lg text-gray-900">{{ stage.value.toLocaleString() }}</span>
                        <span v-if="stage.percentage" class="text-sm text-gray-600 ml-2">({{ stage.percentage.toFixed(1) }}%)</span>
                      </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-8">
                      <div
                        class="h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                        :class="stage.color"
                        :style="{ width: `${stage.barWidth}%` }"
                      >
                        <span v-if="stage.barWidth > 10">{{ stage.barWidth.toFixed(0) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Quick Stats -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white rounded-lg shadow-lg p-6">
                  <p class="text-gray-600 text-sm mb-2">Unique Users</p>
                  <p class="text-3xl font-bold text-gray-900">
                    {{ overview.kpis.total_unique_users.toLocaleString() }}
                  </p>
                </div>
                <div class="bg-white rounded-lg shadow-lg p-6">
                  <p class="text-gray-600 text-sm mb-2">Avg Approval Probability</p>
                  <p class="text-3xl font-bold text-gray-900">
                    {{ (overview.kpis.avg_approval_probability * 100).toFixed(1) }}%
                  </p>
                </div>
                <div class="bg-white rounded-lg shadow-lg p-6">
                  <p class="text-gray-600 text-sm mb-2">Avg Interest Rate</p>
                  <p class="text-3xl font-bold text-gray-900">
                    {{ overview.kpis.avg_interest_rate.toFixed(2) }}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Analytics View -->
          <AdminAnalytics
            v-else-if="activeView === 'analytics'"
            :period-days="selectedPeriodDays"
          />

          <!-- 3. Lenders View -->
          <LenderManagement
            v-else-if="activeView === 'lenders' && canAccessView('lenders')"
          />

          <!-- 4. Performance View -->
          <PerformanceMetrics
            v-else-if="activeView === 'performance' && canAccessView('performance')"
            :period-days="selectedPeriodDays"
          />

          <!-- 5. Reports View -->
          <ReportsPanel
            v-else-if="activeView === 'reports' && canAccessView('reports')"
          />

          <!-- 6. Settings View -->
          <div v-else-if="activeView === 'settings' && canAccessView('settings')" class="space-y-8">
            <h2 class="text-2xl font-bold text-gray-900">System Settings</h2>
            <div class="bg-white rounded-lg shadow-lg p-6">
              <h3 class="text-lg font-bold text-gray-900 mb-4">System Information</h3>
              <p v-if="settingsLoading">Loading...</p>
              <div v-else-if="systemInfo" class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-gray-600 text-sm">Version</p>
                  <p class="text-gray-900 font-semibold">{{ systemInfo.version }}</p>
                </div>
                <div>
                  <p class="text-gray-600 text-sm">Status</p>
                  <p class="text-green-600 font-semibold">✓ {{ systemInfo.status }}</p>
                </div>
                <div>
                  <p class="text-gray-600 text-sm">Total Lenders</p>
                  <p class="text-gray-900 font-semibold">{{ systemInfo.total_lenders }}</p>
                </div>
                <div>
                  <p class="text-gray-600 text-sm">Active Lenders</p>
                  <p class="text-gray-900 font-semibold">{{ systemInfo.active_lenders }}</p>
                </div>
                <div class="col-span-2">
                  <p class="text-gray-600 text-sm mb-2">Features</p>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="feature in systemInfo.features"
                      :key="feature"
                      class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold"
                    >
                      {{ feature }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Restricted Access -->
          <div
            v-if="!canAccessView(activeView)"
            class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center"
          >
            <p class="text-yellow-800 font-semibold text-lg">🔒 Access Restricted</p>
            <p class="text-yellow-700 mt-2">
              Your {{ userRole }} role doesn't have access to this section.
            </p>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminAPI } from '../composables/useAdminAPI';
import AdminAnalytics from './AdminAnalytics.vue';
import LenderManagement from './LenderManagement.vue';
import PerformanceMetrics from './PerformanceMetrics.vue';
import ReportsPanel from './ReportsPanel.vue';

type AdminView = 'dashboard' | 'analytics' | 'lenders' | 'performance' | 'reports' | 'settings';

const props = withDefaults(
  defineProps<{
    userName?: string;
    userRole?: 'admin' | 'analyst' | 'viewer';
    onLogout?: () => void;
  }>(),
  {
    userName: 'Admin User',
    userRole: 'admin',
  }
);

const activeView = ref<AdminView>('dashboard');
const selectedPeriodDays = ref(30);

const {
  healthCheck,
  getStatsOverview,
  getSystemInfo,
  loading: apiLoading,
  error: apiError,
  clearError,
} = useAdminAPI();

const overview = ref<any>(null);
const overviewLoading = ref(false);
const overviewError = ref<string | null>(null);

const systemInfo = ref<any>(null);
const settingsLoading = ref(false);

const navigationItems: { id: AdminView; label: string; icon: string; requires: string[] }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', requires: ['admin', 'analyst', 'viewer'] },
  { id: 'analytics', label: 'Analytics', icon: '📈', requires: ['admin', 'analyst', 'viewer'] },
  { id: 'lenders', label: 'Lenders', icon: '🏦', requires: ['admin'] },
  { id: 'performance', label: 'Performance', icon: '⭐', requires: ['admin', 'analyst'] },
  { id: 'reports', label: 'Reports', icon: '📄', requires: ['admin', 'analyst'] },
  { id: 'settings', label: 'Settings', icon: '⚙️', requires: ['admin'] },
];

const canAccessView = (itemId: AdminView) => {
  const item = navigationItems.find((i) => i.id === itemId);
  return item?.requires.includes(props.userRole) || false;
};

const fetchOverview = async () => {
  try {
    overviewLoading.value = true;
    overviewError.value = null;
    const data = await getStatsOverview(selectedPeriodDays.value);
    overview.value = data;
  } catch (err: any) {
    overviewError.value = err?.message || 'Failed to fetch overview';
  } finally {
    overviewLoading.value = false;
  }
};

const fetchSystemInfo = async () => {
  try {
    settingsLoading.value = true;
    const info = await getSystemInfo();
    systemInfo.value = info;
  } catch (err) {
    console.error('Failed to fetch system info:', err);
  } finally {
    settingsLoading.value = false;
  }
};

const funnelStages = computed(() => {
  if (!overview.value?.funnel) return [];
  const funnel = overview.value.funnel;
  const stages = [
    {
      label: 'View Loan Offers',
      value: funnel.total_views,
      color: 'bg-blue-500',
    },
    {
      label: 'Compare Loans',
      value: funnel.total_comparisons,
      percentage: funnel.view_to_compare,
      color: 'bg-blue-600',
    },
    {
      label: 'Select & Proceed',
      value: funnel.total_selections,
      percentage: funnel.compare_to_select,
      color: 'bg-blue-700',
    },
  ];
  const maxValue = Math.max(...stages.map((s) => s.value)) || 1;
  return stages.map((s) => ({
    ...s,
    barWidth: (s.value / maxValue) * 100,
  }));
});

onMounted(() => {
  healthCheck().catch((err) => console.error('Admin API health check failed:', err));
  fetchOverview();
});

watch(selectedPeriodDays, () => {
  if (activeView.value === 'dashboard') {
    fetchOverview();
  }
});

watch(activeView, (newView) => {
  if (newView === 'dashboard' && !overview.value) {
    fetchOverview();
  } else if (newView === 'settings' && !systemInfo.value) {
    fetchSystemInfo();
  }
});
</script>
