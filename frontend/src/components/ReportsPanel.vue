<template>
  <div class="space-y-8">
    <h2 class="text-2xl font-bold text-gray-900">📋 Reports & Analytics</h2>

    <!-- Report Generation -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-6">Generate New Report</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <!-- Report Type Selection -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-3">
            Report Type
          </label>
          <div class="space-y-2">
            <label
              v-for="type in reportTypes"
              :key="type.id"
              class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
            >
              <input
                type="radio"
                name="reportType"
                :value="type.id"
                v-model="reportType"
                class="w-4 h-4 text-blue-600"
              />
              <div class="ml-3">
                <p class="font-semibold text-gray-900">{{ type.name }}</p>
                <p class="text-xs text-gray-600">{{ type.description }}</p>
              </div>
            </label>
          </div>
        </div>

        <!-- Date Range -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              v-model="dateRange.from"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              To Date
            </label>
            <input
              type="date"
              v-model="dateRange.to"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <button
            @click="handleGenerateReport"
            :disabled="loading"
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            {{ loading ? 'Generating...' : 'Generate Report' }}
          </button>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-900">
        Failed to generate report: {{ error }}
      </div>
    </div>

    <!-- Generated Report Display -->
    <div v-if="generatedReport" class="bg-white rounded-lg shadow-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-gray-900">Report: {{ generatedReport.title }}</h3>
        <div class="flex gap-3">
          <button class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold">
            📥 Download PDF
          </button>
          <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold">
            📧 Email Report
          </button>
        </div>
      </div>

      <div class="space-y-6">
        <div
          v-for="(section, idx) in generatedReport.sections"
          :key="idx"
          class="border-b border-gray-200 pb-6"
        >
          <h4 class="text-md font-bold text-gray-900 mb-4">{{ section.title }}</h4>
          <div class="bg-gray-50 rounded-lg p-4">
            <p class="text-gray-700 text-sm whitespace-pre-wrap">{{ section.content }}</p>
          </div>
        </div>
      </div>

      <div class="mt-6 pt-6 border-t border-gray-200">
        <p class="text-xs text-gray-600">
          Generated at {{ new Date(generatedReport.generated_at).toLocaleString() }}
        </p>
      </div>
    </div>

    <!-- Predefined Reports -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-6">Recent Reports</h3>
      <div class="space-y-3">
        <div
          v-for="(report, idx) in predefinedReports"
          :key="idx"
          class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <div>
            <p class="font-semibold text-gray-900">{{ report.name }}</p>
            <p class="text-xs text-gray-600">{{ report.date }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-600">{{ report.size }}</span>
            <button class="text-blue-600 hover:text-blue-900">
              ⬇️ Download
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useAdminAPI } from '../composables/useAdminAPI';

const { generateReport, loading, error } = useAdminAPI();
const reportType = ref('performance');
const dateRange = reactive({ from: '', to: '' });
const generatedReport = ref<any>(null);

const reportTypes = [
  { id: 'performance', name: '📊 Performance Report', description: 'System and agent performance metrics' },
  { id: 'conversion', name: '📈 Conversion Report', description: 'User conversion and funnel analysis' },
  { id: 'lender', name: '🏦 Lender Report', description: 'Lender performance and market share' },
  { id: 'fraud', name: '🛡️ Fraud Report', description: 'Fraud detection and prevention metrics' },
  { id: 'kyc', name: '🆔 KYC Report', description: 'KYC processing and verification stats' },
];

const predefinedReports = [
  { name: 'Weekly Performance Report', date: '2024-01-15', size: '2.4 MB' },
  { name: 'Monthly Conversion Analysis', date: '2024-01-10', size: '1.8 MB' },
  { name: 'Lender Performance Metrics', date: '2024-01-05', size: '3.1 MB' },
];

const handleGenerateReport = async () => {
  if (!dateRange.from || !dateRange.to) {
    alert('Please select date range');
    return;
  }

  try {
    const report = await generateReport({
      report_type: reportType.value as 'daily' | 'weekly' | 'monthly',
      export_format: 'json',
      email_to: undefined,
    });
    generatedReport.value = report;
  } catch (err) {
    console.error('Failed to generate report:', err);
  }
};
</script>
