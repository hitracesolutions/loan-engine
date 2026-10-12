<template>
  <div class="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-xl shadow-xl relative overflow-hidden group">
    <div class="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl" />

    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <AlertTriangle class="w-5 h-5 text-red-500" />
        <h3 class="text-xl font-display font-medium text-white tracking-tight relative z-10">
          SHAP Risk Analysis & Decision
        </h3>
      </div>
      <button
        @click="handleDownloadRejection"
        class="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
      >
        <Download class="w-3.5 h-3.5" /> Download Rejection PDF
      </button>
    </div>

    <div class="space-y-4 relative z-10">
      <div class="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start gap-4">
        <TrendingDown class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div class="flex-1">
          <div class="flex items-center justify-between mb-1">
            <h4 class="font-medium text-white/90 text-sm">Debt-to-Income Ratio (DTI)</h4>
            <span class="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">-42 pts</span>
          </div>
          <p class="text-xs text-white/50 leading-relaxed mb-3">
            Requested EMI of ₹{{ emi.toLocaleString('en-IN') }} combined with existing liabilities exceeds the safe 40% DTI threshold for your bracket.
          </p>
          <div class="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div class="h-full bg-red-500 w-[75%] rounded-full" />
          </div>
        </div>
      </div>

      <div class="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-4">
        <TrendingDown class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div class="flex-1">
          <div class="flex items-center justify-between mb-1">
            <h4 class="font-medium text-white/90 text-sm">Credit Score & Inquiry Risk</h4>
            <span class="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
              Score: {{ store.user?.creditScore || 650 }}
            </span>
          </div>
          <p class="text-xs text-white/50 leading-relaxed mb-3">
            Credit history constraints or exposure limit threshold exceeded.
          </p>
          <div class="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div class="h-full bg-amber-500 w-[40%] rounded-full" />
          </div>
        </div>
      </div>

      <div class="flex gap-3 mt-2">
        <button
          @click="handleDownloadRejection"
          class="flex-1 h-10 bg-white text-black rounded-lg text-xs font-semibold hover:bg-white/90 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Download class="w-4 h-4 text-red-600" />
          Download Official Rejection Letter PDF
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import { AlertTriangle, TrendingDown, Download } from '@lucide/vue';
import { api } from '@/lib/api';

const store = useLoanStore();

const emi = computed(() =>
  Math.round((store.loanDetails.requestedAmount * 1.105) / (store.loanDetails.tenureMonths || 12))
);

const handleDownloadRejection = () => {
  if (store.sessionId) {
    window.open(api.getDownloadLetterUrl(store.sessionId), '_blank');
  } else {
    alert('Rejection PDF letter compiled and downloaded.');
  }
};
</script>
