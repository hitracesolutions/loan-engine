<template>
  <div class="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-xl relative overflow-hidden">
    <div class="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />

    <div class="flex justify-between items-start mb-8 relative z-10">
      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">Total Outstanding</p>
        <h3 class="text-3xl font-display font-medium text-white">
          ₹{{ store.loanDetails.requestedAmount.toLocaleString('en-IN') }}
        </h3>
      </div>
      <div class="text-right">
        <p class="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">Next EMI Due</p>
        <p class="text-sm font-medium text-white">
          05 {{ new Date().toLocaleString('en-us', { month: 'short' }) }}
        </p>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-6 relative z-10">
      <div class="p-4 rounded-xl bg-[#0A0A0A] border border-white/5">
        <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">EMI Amount</p>
        <p class="text-base font-medium text-white">₹{{ emiAmount.toLocaleString('en-IN') }}</p>
      </div>
      <div class="p-4 rounded-xl bg-[#0A0A0A] border border-white/5">
        <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Tenure Left</p>
        <p class="text-base font-medium text-white">{{ store.loanDetails.tenureMonths }} Months</p>
      </div>
    </div>

    <div class="relative z-10 pt-2">
      <button
        v-if="paymentSuccess"
        disabled
        class="w-full h-12 bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-lg font-medium shadow-lg flex items-center justify-center gap-2 transition-all"
      >
        <CheckCircle2 class="w-4 h-4" />
        Payment Successful
      </button>
      <button
        v-else
        @click="handlePayEmi"
        :disabled="isProcessing"
        class="w-full h-12 bg-white text-black rounded-lg font-medium shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
      >
        <template v-if="isProcessing">
          <span class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          Initializing Secure Gateway...
        </template>
        <template v-else>
          <CreditCard class="w-4 h-4" />
          Pay EMI Now
        </template>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import { CreditCard, CheckCircle2 } from '@lucide/vue';

const store = useLoanStore();
const isProcessing = ref(false);
const paymentSuccess = ref(false);

const emiAmount = computed(() =>
  Math.round((store.loanDetails.requestedAmount * 1.105) / store.loanDetails.tenureMonths)
);

const handlePayEmi = () => {
  isProcessing.value = true;
  setTimeout(() => {
    isProcessing.value = false;
    paymentSuccess.value = true;
    setTimeout(() => {
      paymentSuccess.value = false;
    }, 3000);
  }, 2000);
};
</script>
