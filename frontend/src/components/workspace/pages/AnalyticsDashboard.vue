<template>
  <div class="space-y-8 pb-10">
    <!-- Welcome Banner -->
    <div class="bg-gradient-to-r from-white/10 via-white/5 to-transparent border border-white/10 rounded-2xl p-8 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div class="max-w-2xl space-y-3 relative z-10">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Verified Prime Account
        </div>
        <h1 class="text-3xl lg:text-4xl font-display font-medium tracking-tight text-white">
          Welcome back, {{ store.user?.name || 'Partner' }}
        </h1>
        <p class="text-white/60 text-sm leading-relaxed">
          Your real-time autonomous financial facility is active. Monitor your credit telemetry, active facilities, and pre-approved capital limits below.
        </p>
        <div class="pt-2 flex gap-4">
          <button
            @click="store.setView('APPLICATION')"
            class="px-5 py-2.5 bg-white text-black font-medium text-sm rounded-xl hover:bg-white/90 shadow-lg shadow-white/10 hover:shadow-white/20 transition-all flex items-center gap-2"
          >
            Apply for Capital
            <ArrowUpRight class="w-4 h-4" />
          </button>
          <button
            @click="store.setView('ADVISOR')"
            class="px-5 py-2.5 bg-white/5 text-white border border-white/10 font-medium text-sm rounded-xl hover:bg-white/10 transition-all"
          >
            Consult Advisor
          </button>
        </div>
      </div>
    </div>

    <!-- Analytics Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Credit Telemetry Card -->
      <div class="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-white/20 transition-all">
        <div class="flex justify-between items-start mb-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">CIBIL Telemetry</p>
            <h3 class="text-3xl font-display font-bold text-white tracking-tight">{{ creditScore }}</h3>
          </div>
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <TrendingUp class="w-5 h-5" />
          </div>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between text-xs text-white/60 font-medium">
            <span>Tier-1 Excellent</span>
            <span class="text-emerald-400">Top 5%</span>
          </div>
          <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-500 w-[85%] rounded-full" />
          </div>
        </div>
        <p class="text-xs text-white/40 mt-4">Updated via CIBIL/Experian API 2 mins ago.</p>
      </div>

      <!-- Pre-approved Capital Card -->
      <div class="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-white/20 transition-all">
        <div class="flex justify-between items-start mb-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">Instant Pre-Approved Limit</p>
            <h3 class="text-3xl font-display font-bold text-white tracking-tight">
              ₹{{ (store.user?.preApprovedLimit || (store.user?.salary ? store.user.salary * 10 : 1500000)).toLocaleString('en-IN') }}
            </h3>
          </div>
          <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <CreditCard class="w-5 h-5" />
          </div>
        </div>
        <p class="text-xs text-white/60 leading-relaxed mb-4">
          Zero-collateral instant disbursal available based on verified cash flow telemetry.
        </p>
        <div class="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
          <CheckCircle2 class="w-4 h-4" /> Zero Documentation Required
        </div>
      </div>

      <!-- Active Facility Card -->
      <div class="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-white/20 transition-all">
        <div class="flex justify-between items-start mb-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">Active Facility</p>
            <h3 class="text-3xl font-display font-bold text-white tracking-tight">
              ₹{{ store.loanDetails.requestedAmount.toLocaleString('en-IN') }}
            </h3>
          </div>
          <div class="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Activity class="w-5 h-5" />
          </div>
        </div>
        <div class="flex justify-between items-center text-xs text-white/60 mb-2">
          <span>Next Repayment</span>
          <span class="text-white font-medium">
            ₹{{ Math.round((store.loanDetails.requestedAmount * 1.105) / store.loanDetails.tenureMonths).toLocaleString('en-IN') }}
          </span>
        </div>
        <div class="flex justify-between items-center text-xs text-white/40">
          <span>Due Date</span>
          <span class="text-emerald-400 font-medium">05th Next Month</span>
        </div>
      </div>
    </div>

    <!-- Recent History Table -->
    <div class="bg-[#111] border border-white/10 rounded-2xl p-6">
      <h3 class="text-lg font-display font-medium text-white mb-4 tracking-tight">Facility & Audit History</h3>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-white/70">
          <thead class="text-xs font-semibold text-white/40 uppercase tracking-wider border-b border-white/10">
            <tr>
              <th class="pb-3">Facility ID</th>
              <th class="pb-3">Date</th>
              <th class="pb-3">Amount</th>
              <th class="pb-3">Status</th>
              <th class="pb-3">Lender Partner</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 font-mono text-xs">
            <tr v-if="history.length > 0" v-for="(item, idx) in history" :key="idx">
              <td class="py-4 text-white">
                #{{ item.session_id ? item.session_id.substring(0, 10).toUpperCase() : `FAC-${idx}` }}
              </td>
              <td class="py-4 text-white/60">
                {{ item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent' }}
              </td>
              <td class="py-4 text-white font-medium">
                ₹{{ (item.amount || store.loanDetails.requestedAmount).toLocaleString('en-IN') }}
              </td>
              <td class="py-4">
                <span
                  :class="[
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-sans text-xs',
                    item.status === 'Approved' || item.status === 'Disbursed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-white/10 text-white/60 border-white/10'
                  ]"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" /> {{ item.status || 'Active' }}
                </span>
              </td>
              <td class="py-4 text-white/60">{{ item.loan_type || 'HDFC Bank NBFC' }}</td>
            </tr>
            <tr v-else>
              <td colspan="5" class="py-8 text-center text-white/40 font-sans text-xs">
                No active loan facility history recorded in MongoDB for this account. Apply for capital to initialize your first facility.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import {
  TrendingUp,
  CreditCard,
  Activity,
  ArrowUpRight,
  CheckCircle2,
} from '@lucide/vue';
import { api } from '@/lib/api';

const store = useLoanStore();
const history = ref<any[]>([]);

const creditScore = computed(() => store.user?.creditScore || 785);

onMounted(async () => {
  if (store.user?.phone) {
    const res = await api.getLoanHistory(store.user.phone);
    if (res.success && res.data?.history) {
      history.value = res.data.history;
    }
  }
});
</script>
