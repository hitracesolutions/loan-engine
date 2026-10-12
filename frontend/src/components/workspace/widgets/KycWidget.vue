<template>
  <div class="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-xl shadow-xl relative overflow-hidden group">
    <div class="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />

    <div class="flex justify-between items-center mb-6 relative z-10">
      <div>
        <h3 class="text-xl font-display font-medium text-white tracking-tight flex items-center gap-2">
          <ScanFace class="w-5 h-5 text-amber-500" />
          Vision AI Identity Verification
        </h3>
        <p class="text-xs text-white/40 mt-1">Select either Aadhaar OR PAN to proceed</p>
      </div>

      <button
        @click="handleDigiLockerFetch"
        :disabled="isFetchingDigiLocker || isVerified"
        class="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
      >
        <template v-if="isFetchingDigiLocker">
          <Loader2 class="w-3.5 h-3.5 animate-spin" /> Fetching DigiLocker...
        </template>
        <template v-else>
          <ShieldCheck class="w-3.5 h-3.5" /> 1-Click DigiLocker Auto-Fetch
        </template>
      </button>
    </div>

    <div class="space-y-4 relative z-10">
      <div
        @click="!aadhaarVerified && handleUpload('AADHAAR')"
        :class="[
          'p-4 rounded-xl border flex items-center justify-between transition-all',
          aadhaarVerified
            ? 'bg-emerald-500/10 border-emerald-500/30 cursor-default'
            : 'bg-[#0A0A0A] border-white/10 border-dashed hover:border-white/30 cursor-pointer'
        ]"
      >
        <div>
          <h4 class="font-medium text-white mb-1">Aadhaar XML Record</h4>
          <p class="text-xs text-white/40 uppercase tracking-widest font-medium">UIDAI 12-Digit Identity</p>
        </div>
        <CheckCircle2 v-if="aadhaarVerified" class="w-6 h-6 text-emerald-500" />
        <FileUp v-else class="w-5 h-5 text-white/50" />
      </div>

      <div
        @click="!panVerified && handleUpload('PAN')"
        :class="[
          'p-4 rounded-xl border flex items-center justify-between transition-all',
          panVerified
            ? 'bg-emerald-500/10 border-emerald-500/30 cursor-default'
            : 'bg-[#0A0A0A] border-white/10 border-dashed hover:border-white/30 cursor-pointer'
        ]"
      >
        <div>
          <h4 class="font-medium text-white mb-1">PAN Card Record</h4>
          <p class="text-xs text-white/40 uppercase tracking-widest font-medium">Income Tax Dept Record</p>
        </div>
        <CheckCircle2 v-if="panVerified" class="w-6 h-6 text-emerald-500" />
        <FileUp v-else class="w-5 h-5 text-white/50" />
      </div>

      <button
        @click="handleProceed"
        :disabled="!isVerified"
        class="w-full mt-6 h-12 bg-white text-black rounded-lg font-medium shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
      >
        <span class="flex items-center gap-2 font-semibold">
          Initiate Underwriting Decision Engine
          <ArrowRight class="w-4 h-4" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import { FileUp, CheckCircle2, ScanFace, ArrowRight, ShieldCheck, Loader2 } from '@lucide/vue';
import { api } from '@/lib/api';

const emit = defineEmits<{
  (e: 'next'): void;
}>();

const store = useLoanStore();
const aadhaarVerified = ref(false);
const panVerified = ref(false);
const isFetchingDigiLocker = ref(false);

const isVerified = computed(() => aadhaarVerified.value || panVerified.value);

const handleUpload = (doc: 'AADHAAR' | 'PAN') => {
  if (doc === 'AADHAAR') aadhaarVerified.value = true;
  if (doc === 'PAN') panVerified.value = true;
};

const handleDigiLockerFetch = async () => {
  isFetchingDigiLocker.value = true;
  try {
    if (store.sessionId) {
      await api.fetchDigiLocker(store.sessionId);
    } else {
      await new Promise((r) => setTimeout(r, 600));
    }
    aadhaarVerified.value = true;
    panVerified.value = true;
  } catch (e) {
    console.error(e);
  } finally {
    isFetchingDigiLocker.value = false;
  }
};

const handleProceed = () => {
  store.setState('DECISION_READY');
  emit('next');
};
</script>
