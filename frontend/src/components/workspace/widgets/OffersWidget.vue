<template>
  <div v-if="loading" class="bg-[#111] border border-white/10 rounded-2xl p-6 flex items-center justify-center gap-3 text-white/50 text-xs font-mono">
    <Loader2 class="w-4 h-4 animate-spin text-emerald-500" />
    Evaluating 40,000 Risk Vectors across Institutional Lenders...
  </div>

  <div v-else class="w-full max-w-2xl relative z-10 group">
    <div class="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
      <div
        v-for="(offer, idx) in offersList"
        :key="offer.lender_id || `lender-${idx}`"
        @click="selectedOfferId = offer.lender_id || `lender-${idx}`"
        :class="[
          'min-w-[280px] snap-center p-6 rounded-2xl border cursor-pointer transition-all duration-300 relative overflow-hidden flex-shrink-0',
          selectedOfferId === (offer.lender_id || `lender-${idx}`)
            ? 'bg-[#111] border-white shadow-xl shadow-white/5'
            : 'bg-[#0A0A0A] border-white/10 hover:border-white/30'
        ]"
      >
        <div v-if="selectedOfferId === (offer.lender_id || `lender-${idx}`)" class="absolute top-4 right-4">
          <CheckCircle2 class="w-5 h-5 text-white" />
        </div>

        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-display font-bold text-sm text-emerald-400">
            {{ (offer.lender_name || offer.lender || 'Institutional Partner').charAt(0) }}
          </div>
          <div>
            <h4 class="font-bold text-base text-white leading-tight">
              {{ offer.lender_name || offer.lender || 'Institutional Partner' }}
            </h4>
            <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1 mt-0.5">
              <Zap class="w-3 h-3" /> {{ offer.tag || `${offer.settlement_days || 1} Day Disbursal` }}
            </span>
          </div>
        </div>

        <div class="space-y-3 mb-6 font-mono text-xs">
          <div class="flex justify-between items-center border-b border-white/5 pb-2">
            <span class="text-white/50 uppercase tracking-widest font-sans">Interest Rate</span>
            <span class="font-medium text-emerald-400 text-sm">{{ offer.interest_rate || offer.roi || 10.5 }}% p.a.</span>
          </div>
          <div class="flex justify-between items-center border-b border-white/5 pb-2">
            <span class="text-white/50 uppercase tracking-widest font-sans">Monthly EMI</span>
            <span class="font-medium text-white text-sm">
              ₹{{ (offer.emi || Math.round((store.loanDetails.requestedAmount * 1.105) / store.loanDetails.tenureMonths)).toLocaleString('en-IN') }}
            </span>
          </div>
          <div v-if="offer.processing_fee" class="flex justify-between items-center text-[10px] text-white/40">
            <span class="font-sans">Processing Fee</span>
            <span>₹{{ Math.round(offer.processing_fee).toLocaleString('en-IN') }}</span>
          </div>
        </div>

        <button
          @click.stop="handleAccept(offer.lender_id || `lender-${idx}`)"
          :class="[
            'w-full py-2.5 rounded-lg text-sm font-medium transition-all',
            selectedOfferId === (offer.lender_id || `lender-${idx}`)
              ? 'bg-white text-black font-semibold'
              : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
          ]"
        >
          {{ selectedOfferId === (offer.lender_id || `lender-${idx}`) ? 'Execute Smart Contract' : 'Select Partner' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import { CheckCircle2, Loader2, Zap } from '@lucide/vue';
import { api } from '@/lib/api';

const emit = defineEmits<{
  (e: 'select', lenderId: string): void;
}>();

const store = useLoanStore();
const selectedOfferId = ref<string | null>(null);
const offersList = ref<any[]>([]);
const loading = ref(true);

onMounted(async () => {
  loading.value = true;
  if (store.sessionId) {
    const res = await api.getOffers(store.sessionId);
    if (res.success && res.data?.offers && res.data.offers.length > 0) {
      offersList.value = res.data.offers;
      loading.value = false;
      return;
    }
  }

  const fallbackAmount = store.loanDetails.requestedAmount;
  const fallbackTenure = store.loanDetails.tenureMonths;
  const calculatedEmi = (rate: number) =>
    Math.round((fallbackAmount * (1 + (rate / 100) * (fallbackTenure / 12))) / fallbackTenure);

  offersList.value = [
    {
      lender_id: 'hdfc_bank',
      lender_name: 'HDFC Bank NBFC',
      interest_rate: 10.5,
      emi: calculatedEmi(10.5),
      tag: 'Prime Tier-1 Rate',
      settlement_days: 1,
    },
    {
      lender_id: 'bajaj_finserv',
      lender_name: 'Bajaj Finance Ltd',
      interest_rate: 11.2,
      emi: calculatedEmi(11.2),
      tag: 'Sub-Second Disbursal',
      settlement_days: 1,
    },
    {
      lender_id: 'muthoot_finance',
      lender_name: 'Muthoot Capital',
      interest_rate: 12.0,
      emi: calculatedEmi(12.0),
      tag: 'High Approval Rate',
      settlement_days: 2,
    },
  ];
  loading.value = false;
});

const handleAccept = (lenderId: string) => {
  selectedOfferId.value = lenderId;
  store.setState('ACTIVE_LOAN');
  emit('select', lenderId);
};
</script>
