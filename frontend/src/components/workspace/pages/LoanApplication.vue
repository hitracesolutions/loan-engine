<template>
  <div class="space-y-8 max-w-4xl mx-auto pb-12">
    <!-- Step Tracker Header -->
    <div class="bg-[#111] border border-white/10 rounded-2xl p-6">
      <div class="flex justify-between items-center relative">
        <div v-for="(s, idx) in steps" :key="s.id" class="flex items-center gap-3 relative z-10">
          <div
            :class="[
              'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all',
              step > s.id
                ? 'bg-emerald-500 text-black'
                : step === s.id
                ? 'bg-white text-black ring-4 ring-white/10'
                : 'bg-white/5 text-white/40 border border-white/10'
            ]"
          >
            <Check v-if="step > s.id" class="w-4 h-4" />
            <span v-else>{{ s.id }}</span>
          </div>
          <span :class="['text-sm font-medium hidden sm:block', step === s.id ? 'text-white' : 'text-white/40']">
            {{ s.name }}
          </span>
          <ChevronRight v-if="idx < steps.length - 1" class="w-4 h-4 text-white/20 hidden md:block ml-2" />
        </div>
      </div>
    </div>

    <!-- Main Form Display Area -->
    <div class="flex justify-center">
      <div v-if="step === 1" class="w-full max-w-xl">
        <OnboardingWidget @next="handleParamsSubmit" />
      </div>
      <div v-else-if="step === 2" class="w-full max-w-xl">
        <KycWidget @next="handleKycSubmit" />
      </div>
      <div v-else-if="step === 3" class="w-full">
        <OffersWidget @select="handleOfferSelect" />
      </div>
      <div v-else-if="step === 4" class="w-full">
        <SanctionViewer />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import OnboardingWidget from '../widgets/OnboardingWidget.vue';
import KycWidget from '../widgets/KycWidget.vue';
import OffersWidget from '../widgets/OffersWidget.vue';
import SanctionViewer from '../widgets/SanctionViewer.vue';
import { Check, ChevronRight } from '@lucide/vue';
import { api } from '@/lib/api';

const store = useLoanStore();
const step = ref(1);

const steps = [
  { id: 1, name: 'Capital Selection' },
  { id: 2, name: 'Vision AI KYC' },
  { id: 3, name: 'StateGraph Underwriting' },
  { id: 4, name: 'Facility Sanction' },
];

const runAgentTask = async (logs: string[], taskFn: () => Promise<void>) => {
  store.clearAgentLogs();
  store.setAgentActive(true);

  for (const log of logs) {
    store.addAgentLog(log);
    await new Promise((res) => setTimeout(res, 500));
  }

  try {
    await taskFn();
  } catch (e: any) {
    store.addAgentLog(`❌ Error: ${e.message}`);
  } finally {
    setTimeout(() => store.setAgentActive(false), 800);
  }
};

const handleParamsSubmit = async () => {
  await runAgentTask(
    [
      'POST /session/start initializing StateGraph workflow...',
      'Invoking Sales Agent (LangGraph node)...',
      'POST /sales/capture-loan-params calculating DTI & FOIR...',
      'Comparing 40,000+ data vectors across partner NBFCs...',
    ],
    async () => {
      let activeSessionId = store.sessionId;
      if (!activeSessionId) {
        const startRes = await api.startSession();
        if (startRes.success && startRes.data) {
          activeSessionId = startRes.data.session_id;
          store.setSessionId(activeSessionId!);
        }
      }

      if (activeSessionId) {
        await api.updateLoanParams(activeSessionId, {
          requested_amount: store.loanDetails.requestedAmount,
          tenure_months: store.loanDetails.tenureMonths,
        });
      }
      step.value = 2;
    }
  );
};

const handleKycSubmit = async () => {
  await runAgentTask(
    [
      'POST /documents/upload verifying XML signatures...',
      'Invoking Vision AI Agent (OCR & Fraud Verification)...',
      'Bypass Mode Active: Approved Aadhaar & PAN hashes',
      'POST /session/underwrite running Decision Engine...',
      'StateGraph Underwriter: APPROVED for partner disbursal.',
    ],
    async () => {
      if (store.sessionId) {
        await api.underwrite(store.sessionId);
      }
      step.value = 3;
    }
  );
};

const handleOfferSelect = async (lenderId: string) => {
  await runAgentTask(
    [
      `POST /session/select-lender selected partner ${lenderId}...`,
      'Executing Smart Contract & eNACH Mandate...',
      'POST /session/sanction generating PDF Sanction Letter...',
    ],
    async () => {
      if (store.sessionId) {
        await api.selectLender(store.sessionId, { selected_lender_id: lenderId });
        await api.generateSanction(store.sessionId);
      }
      step.value = 4;
    }
  );
};
</script>
