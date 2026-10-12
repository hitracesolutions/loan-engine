<template>
  <div class="bg-[#111] border border-white/10 rounded-2xl flex flex-col overflow-hidden h-full shadow-2xl">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-white/10 bg-white/[0.02] flex items-center gap-2.5 shrink-0">
      <div class="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
        <GitBranch class="w-3.5 h-3.5 text-indigo-400" />
      </div>
      <div class="min-w-0">
        <p class="text-xs font-semibold text-white leading-none">LangGraph DAG</p>
        <p class="text-[9px] text-white/40 font-mono uppercase tracking-wider mt-0.5">Multi-Agent Orchestration</p>
      </div>
      <div v-if="isStreaming" class="ml-auto flex items-center gap-1.5">
        <Loader2 class="w-3 h-3 text-emerald-400 animate-spin" />
        <span class="text-[9px] text-emerald-400 font-mono uppercase tracking-wide">Processing</span>
      </div>
    </div>

    <!-- Node flow -->
    <div class="flex-1 overflow-y-auto p-3 space-y-0.5 scrollbar-hide">
      <div v-for="(node, idx) in NODES" :key="node.id">
        <div
          :class="[
            'flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-500',
            getStatus(idx) === 'active'
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : getStatus(idx) === 'done'
              ? 'bg-white/[0.02] border border-transparent'
              : 'border border-transparent opacity-40'
          ]"
        >
          <!-- Status dot / icon -->
          <div class="shrink-0 mt-0.5">
            <CheckCircle2 v-if="getStatus(idx) === 'done'" class="w-4 h-4 text-emerald-500" />
            <div
              v-else-if="getStatus(idx) === 'active'"
              :class="[
                'w-4 h-4 rounded-full border-2 border-emerald-400 flex items-center justify-center transition-all',
                tickIdx % 2 === 0 ? 'shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]' : ''
              ]"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <Circle v-else class="w-4 h-4 text-white/20" />
          </div>

          <!-- Node info -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <component
                :is="node.icon"
                :class="[
                  'w-3 h-3 shrink-0',
                  getStatus(idx) === 'done'
                    ? 'text-emerald-400'
                    : getStatus(idx) === 'active'
                    ? 'text-emerald-300'
                    : 'text-white/30'
                ]"
              />
              <p
                :class="[
                  'text-xs font-semibold leading-none',
                  getStatus(idx) === 'done'
                    ? 'text-white/70'
                    : getStatus(idx) === 'active'
                    ? 'text-white'
                    : 'text-white/30'
                ]"
              >
                {{ node.label }}
              </p>
              <span
                v-if="getStatus(idx) === 'active' && isStreaming"
                class="text-[8px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wide ml-auto shrink-0"
              >
                running
              </span>
              <span
                v-if="getStatus(idx) === 'done'"
                class="text-[8px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wide ml-auto shrink-0"
              >
                done
              </span>
            </div>
            <p
              :class="[
                'text-[9px] mt-1 leading-snug font-mono',
                getStatus(idx) === 'active'
                  ? 'text-emerald-400/70'
                  : getStatus(idx) === 'done'
                  ? 'text-white/30'
                  : 'text-white/15'
              ]"
            >
              {{ node.sub }}
            </p>
          </div>
        </div>

        <!-- Connector line between nodes -->
        <div v-if="idx < NODES.length - 1" class="ml-[22px] pl-3 py-0.5">
          <div
            :class="[
              'w-px h-3',
              getStatus(idx) === 'done' ? 'bg-emerald-500/40' : 'bg-white/10'
            ]"
          />
        </div>
      </div>
    </div>

    <!-- Footer: active phase label -->
    <div class="px-4 py-2.5 border-t border-white/5 bg-black/20 shrink-0">
      <p class="text-[9px] text-white/30 font-mono uppercase tracking-widest">
        Phase: <span class="text-white/60">{{ currentPhase || 'initializing' }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  UserCheck,
  Brain,
  ShieldCheck,
  FileSearch,
  Scale,
  Landmark,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Circle,
  Loader2,
  GitBranch,
} from '@lucide/vue';

const props = defineProps<{
  currentPhase: string;
  nextAgent?: string;
  isStreaming?: boolean;
}>();

const NODES = [
  { id: 'load_session', label: 'Load Session', sub: 'CRM Context / Profile Hydration', icon: UserCheck },
  { id: 'intent_agent', label: 'Intent Classifier', sub: 'NLP → LoanRequest / EMI / General', icon: Brain },
  { id: 'sales_agent', label: 'Sales Agent', sub: 'Arjun — Terms Discovery & Lenders', icon: Landmark },
  { id: 'document_agent', label: 'Document Agent', sub: 'DigiLocker · OCR · Aadhaar / PAN', icon: FileSearch },
  { id: 'kyc_agent', label: 'KYC & Fraud Agent', sub: 'Identity Verification · AML Check', icon: ShieldCheck },
  { id: 'underwriting_agent', label: 'Underwriting Agent', sub: 'FOIR · DTI · CIBIL Risk Engine', icon: Scale },
  { id: 'sanction_agent', label: 'Sanction Agent', sub: 'ReportLab PDF · SMTP Dispatch', icon: BadgeCheck },
  { id: 'bank_verification', label: 'Bank Verification', sub: 'Penny Drop ₹1 · eNACH Mandate', icon: BadgeCheck },
  { id: 'disbursement', label: 'Disbursement Node', sub: 'Fund Release · Ledger Entry', icon: Banknote },
];

const PHASE_TO_NODE: Record<string, string> = {
  load_session: 'load_session',
  intent: 'intent_agent',
  sales: 'sales_agent',
  kyc_verification: 'document_agent',
  document_verification: 'document_agent',
  kyc_agent: 'kyc_agent',
  underwriting: 'underwriting_agent',
  underwriting_agent: 'underwriting_agent',
  sanction: 'sanction_agent',
  sanction_agent: 'sanction_agent',
  bank_verification: 'bank_verification',
  bank_verification_agent: 'bank_verification',
  disbursement: 'disbursement',
  active: 'intent_agent',
};

const tickIdx = ref(0);
let interval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  interval = setInterval(() => {
    tickIdx.value++;
  }, 800);
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
});

const activeNodeId = computed(() => {
  return (
    PHASE_TO_NODE[props.nextAgent || ''] ||
    PHASE_TO_NODE[props.currentPhase] ||
    'load_session'
  );
});

const activeIdx = computed(() => NODES.findIndex((n) => n.id === activeNodeId.value));

const getStatus = (idx: number): 'done' | 'active' | 'pending' => {
  if (idx < activeIdx.value) return 'done';
  if (idx === activeIdx.value) return 'active';
  return 'pending';
};
</script>
