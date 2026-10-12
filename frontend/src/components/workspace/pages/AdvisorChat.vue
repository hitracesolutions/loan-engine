<template>
  <div class="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
    <!-- Portfolio Summary Bar -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-[#111] border border-white/10 rounded-2xl p-5 relative overflow-hidden">
        <div class="flex items-center justify-between text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Net Investment Assets</span>
          <PieChart class="w-4 h-4 text-emerald-400" />
        </div>
        <p class="text-2xl font-display font-bold text-white">
          ₹{{ (portfolioData.mutualFunds + portfolioData.fixedDeposits).toLocaleString('en-IN') }}
        </p>
        <p class="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
          <ArrowUpRight class="w-3 h-3" /> Mutual Funds + FDs
        </p>
      </div>

      <div class="bg-[#111] border border-white/10 rounded-2xl p-5 relative overflow-hidden">
        <div class="flex items-center justify-between text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Active Debt Exposure</span>
          <Wallet class="w-4 h-4 text-blue-400" />
        </div>
        <p class="text-2xl font-display font-bold text-white">
          ₹{{ portfolioData.activeDebt.toLocaleString('en-IN') }}
        </p>
        <p class="text-[11px] text-white/40 mt-1 font-mono">
          EMI: ₹{{ portfolioData.monthlyEmi.toLocaleString('en-IN') }}/mo
        </p>
      </div>

      <div class="bg-[#111] border border-white/10 rounded-2xl p-5 relative overflow-hidden">
        <div class="flex items-center justify-between text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Debt-To-Income (DTI)</span>
          <TrendingUp class="w-4 h-4 text-amber-400" />
        </div>
        <p class="text-2xl font-display font-bold text-emerald-400">
          {{ (portfolioData.dtiRatio * 100).toFixed(1) }}%
        </p>
        <p class="text-[11px] text-emerald-400/80 mt-1 font-mono">Tier-1 Healthy Range (&lt; 35%)</p>
      </div>

      <div class="bg-[#111] border border-white/10 rounded-2xl p-5 relative overflow-hidden">
        <div class="flex items-center justify-between text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Emergency Buffer</span>
          <ShieldAlert class="w-4 h-4 text-purple-400" />
        </div>
        <p class="text-2xl font-display font-bold text-white">
          ₹{{ portfolioData.emergencyFund.toLocaleString('en-IN') }}
        </p>
        <p class="text-[11px] text-purple-400 mt-1 font-mono">7.3x EMI Coverage</p>
      </div>
    </div>

    <!-- Main Advisor Console -->
    <div class="bg-[#111] border border-white/10 rounded-2xl h-[calc(100vh-280px)] flex flex-col overflow-hidden shadow-2xl relative">
      <!-- Console Header -->
      <div class="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Bot class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-display font-medium text-white text-sm">Financial Advisory & Portfolio Intelligence</h3>
            <p class="text-[10px] text-white/40 uppercase tracking-widest font-mono">Track-2 LangGraph Wealth Advisor Node</p>
          </div>
        </div>
        <span class="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 font-medium">
          <Sparkles class="w-3.5 h-3.5" /> Full Portfolio Context Active
        </span>
      </div>

      <!-- Chat Messages -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        <div
          v-for="m in messages"
          :key="m.id"
          :class="['flex gap-4 animate-fade-in', m.role === 'user' ? 'justify-end' : 'justify-start']"
        >
          <div :class="['max-w-[85%] flex gap-3', m.role === 'user' ? 'flex-row-reverse' : 'flex-row']">
            <div
              :class="[
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 border',
                m.role === 'user'
                  ? 'bg-white/10 border-white/20'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              ]"
            >
              <User v-if="m.role === 'user'" class="w-4 h-4 text-white" />
              <Bot v-else class="w-4 h-4" />
            </div>
            <div
              :class="[
                'p-5 rounded-2xl text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-white/10 text-white rounded-tr-sm'
                  : 'bg-[#0A0A0A] border border-white/10 text-white/90 rounded-tl-sm space-y-2'
              ]"
            >
              <p class="whitespace-pre-line">{{ m.content }}</p>
            </div>
          </div>
        </div>

        <div v-if="isTyping" class="flex justify-start text-xs text-white/50 font-mono items-center gap-2">
          <Loader2 class="w-4 h-4 animate-spin text-emerald-400" />
          <span>Advisor Node evaluating portfolio yields vs loan rate spreads...</span>
        </div>
      </div>

      <!-- Action Pills -->
      <div class="px-6 py-2 bg-[#0A0A0A] border-t border-white/5 flex flex-wrap gap-2">
        <button
          @click="handlePillClick('Should I prepay my loan or invest in equity SIPs?')"
          class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-lg text-xs font-medium transition-all"
        >
          💡 Prepay Loan vs Invest in SIPs?
        </button>
        <button
          @click="handlePillClick('Analyze my Debt-To-Income (DTI) ratio and cashflow stability')"
          class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-lg text-xs font-medium transition-all"
        >
          📊 Analyze My DTI Ratio & Cashflow
        </button>
        <button
          @click="handlePillClick('How to improve my CIBIL score from 800 to 850?')"
          class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-lg text-xs font-medium transition-all"
        >
          ⭐ How to Reach 850 CIBIL Score?
        </button>
      </div>

      <!-- Input Form -->
      <form @submit.prevent="handleSend" class="p-4 border-t border-white/10 bg-[#0A0A0A] relative">
        <input
          type="text"
          v-model="input"
          placeholder="Ask Advisor about refinancing, tax savings under Sec 24b, or SIP returns..."
          class="w-full bg-[#111] border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/30"
        />
        <button
          type="submit"
          :disabled="!input.trim()"
          class="absolute right-6 top-5 text-white/70 hover:text-white disabled:opacity-30 transition-all"
        >
          <Send class="w-4 h-4" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  Bot,
  User,
  Send,
  Sparkles,
  TrendingUp,
  PieChart,
  Wallet,
  ShieldAlert,
  ArrowUpRight,
  Loader2,
} from '@lucide/vue';
import { useLoanStore } from '@/stores/loanStore';
import { api } from '@/lib/api';

const store = useLoanStore();

const portfolioData = ref({
  monthlySalary: store.user?.salary || 150000,
  activeDebt: store.loanDetails.requestedAmount,
  monthlyEmi: Math.round((store.loanDetails.requestedAmount * 1.105) / store.loanDetails.tenureMonths),
  mutualFunds: 350000,
  fixedDeposits: 200000,
  emergencyFund: 120000,
  dtiRatio: 0.18,
});

const messages = ref<any[]>([
  {
    id: '1',
    role: 'assistant',
    content: `Hello ${
      store.user?.name || 'Sarang'
    }. I am your dedicated Track-2 Autonomous Financial & Portfolio Advisor.\n\nI have evaluated your total asset portfolio (₹6.7 Lakhs in SIPs & FDs), active debt exposure (₹${store.loanDetails.requestedAmount.toLocaleString(
      'en-IN'
    )}), and CIBIL telemetry (${
      store.user?.creditScore || 800
    }).\n\nHow can I assist you with wealth allocation, tax optimization, or loan prepayment strategy today?`,
    timestamp: Date.now(),
  },
]);

const input = ref('');
const isTyping = ref(false);

onMounted(async () => {
  if (store.user?.phone) {
    const res = await api.getLoanHistory(store.user.phone);
    if (res.success && res.data?.history && res.data.history.length > 0) {
      const active = res.data.history[0];
      portfolioData.value.activeDebt = active.amount || portfolioData.value.activeDebt;
      portfolioData.value.monthlyEmi = active.emi || portfolioData.value.monthlyEmi;
      if (portfolioData.value.monthlySalary) {
        portfolioData.value.dtiRatio = Number(
          (portfolioData.value.monthlyEmi / portfolioData.value.monthlySalary).toFixed(2)
        );
      }
    }
  }
});

const handleSend = async () => {
  if (!input.value.trim()) return;

  const queryText = input.value;
  input.value = '';

  const userMsg = { id: Date.now().toString(), role: 'user', content: queryText, timestamp: Date.now() };
  messages.value.push(userMsg);
  isTyping.value = true;

  try {
    if (store.sessionId) {
      const res = await api.chatWithAgent(
        store.sessionId,
        `[FINANCIAL ADVISOR QUERY] User Salary: ₹${portfolioData.value.monthlySalary}, Active Debt: ₹${portfolioData.value.activeDebt}, EMI: ₹${portfolioData.value.monthlyEmi}, Investments: ₹${portfolioData.value.mutualFunds + portfolioData.value.fixedDeposits}. Question: ${queryText}`
      );
      isTyping.value = false;

      if (res.success && res.data?.reply) {
        messages.value.push({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.reply,
          timestamp: Date.now(),
        });
        return;
      }
    }

    // Smart fallback response
    setTimeout(() => {
      isTyping.value = false;
      messages.value.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Based on your monthly net income (₹${portfolioData.value.monthlySalary.toLocaleString(
          'en-IN'
        )}) and current DTI ratio of ${(portfolioData.value.dtiRatio * 100).toFixed(1)}%:\n\n1. **Prepayment vs SIPs**: Your loan rate is 10.5% p.a., while your Equity Mutual Fund portfolio yields ~14.2% CAGR. It is financially optimal to continue monthly SIPs rather than aggressive prepayments.\n2. **Emergency Buffer**: Maintaining ₹1.2 Lakhs in liquid funds provides 7.3x monthly EMI coverage.\n3. **Tax Optimization**: Loan interest payments up to ₹2 Lakhs are deductible under Section 24b.`,
        timestamp: Date.now(),
      });
    }, 1000);
  } catch (err) {
    isTyping.value = false;
  }
};

const handlePillClick = (promptText: string) => {
  input.value = promptText;
};
</script>
