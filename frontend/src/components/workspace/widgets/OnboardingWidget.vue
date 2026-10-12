<template>
  <div class="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-xl shadow-xl relative overflow-hidden group animate-fade-in">
    <div class="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors" />

    <div class="flex justify-between items-center mb-6 relative z-10 border-b border-white/10 pb-4">
      <h3 class="text-xl font-display font-medium text-white tracking-tight flex items-center gap-2">
        <Banknote class="w-5 h-5 text-emerald-500" />
        Capital Requirement Configurator
      </h3>
      <span class="text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
        <Calculator class="w-3.5 h-3.5" /> ₹{{ calculatedEmi.toLocaleString('en-IN') }}/mo EMI
      </span>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6 relative z-10">
      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="text-xs font-semibold uppercase tracking-widest text-white/50">Requested Principal</label>
          <span class="font-display text-2xl font-bold tracking-tight text-white">
            ₹{{ amount.toLocaleString('en-IN') }}
          </span>
        </div>
        <input
          type="range"
          min="20000"
          max="2000000"
          step="10000"
          :value="amount"
          @input="handleAmountChange(Number(($event.target as HTMLInputElement).value))"
          class="w-full h-1.5 bg-[#0A0A0A] rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div class="flex justify-between text-xs text-white/30 mt-2 font-mono">
          <span>₹20K</span>
          <span>₹10L</span>
          <span>₹20L</span>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="text-xs font-semibold uppercase tracking-widest text-white/50 flex items-center gap-1">
            <Calendar class="w-3.5 h-3.5 text-emerald-400" /> Auto-Scaled Tenure
          </label>
          <span class="font-display text-2xl font-bold tracking-tight text-emerald-400">{{ tenure }} Months</span>
        </div>
        <input
          type="range"
          min="6"
          max="60"
          step="6"
          :value="tenure"
          @input="handleTenureChange(Number(($event.target as HTMLInputElement).value))"
          class="w-full h-1.5 bg-[#0A0A0A] rounded-lg appearance-none cursor-pointer accent-white"
        />
        <div class="flex justify-between text-xs text-white/30 mt-2 font-mono">
          <span>6M</span>
          <span>24M</span>
          <span>60M</span>
        </div>
      </div>

      <!-- Live EMI Breakdown -->
      <div class="bg-[#0A0A0A] p-4 rounded-xl border border-white/5 font-mono text-xs flex justify-between items-center">
        <div>
          <span class="text-white/40 block font-sans text-[10px]">Estimated Prime Rate</span>
          <span class="text-white font-bold text-sm font-sans">10.5% p.a.</span>
        </div>
        <div class="text-right">
          <span class="text-white/40 block font-sans text-[10px]">Calculated Monthly EMI</span>
          <span class="text-emerald-400 font-bold text-base">₹{{ calculatedEmi.toLocaleString('en-IN') }}</span>
        </div>
      </div>

      <button
        type="submit"
        class="w-full h-12 bg-white text-black rounded-xl font-semibold shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 text-sm"
      >
        Confirm Parameters & Proceed to KYC →
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import { Banknote, Calendar, Calculator } from '@lucide/vue';

const emit = defineEmits<{
  (e: 'next'): void;
}>();

const store = useLoanStore();
const amount = ref(store.loanDetails.requestedAmount);
const tenure = ref(store.loanDetails.tenureMonths);

const handleAmountChange = (newAmount: number) => {
  amount.value = newAmount;

  let recommendedTenure = 36;
  if (newAmount <= 100000) recommendedTenure = 12;
  else if (newAmount <= 300000) recommendedTenure = 24;
  else if (newAmount <= 700000) recommendedTenure = 36;
  else if (newAmount <= 1200000) recommendedTenure = 48;
  else recommendedTenure = 60;

  tenure.value = recommendedTenure;
};

const handleTenureChange = (newTenure: number) => {
  tenure.value = newTenure;
};

const calculatedEmi = computed(() =>
  Math.round((amount.value * (1 + 0.105 * (tenure.value / 12))) / tenure.value)
);

const handleSubmit = () => {
  store.updateLoanDetails({ requestedAmount: amount.value, tenureMonths: tenure.value });
  store.setState('DOCUMENT_COLLECTION');
  emit('next');
};
</script>
