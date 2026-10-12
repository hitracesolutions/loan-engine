<template>
  <div class="w-72 border-r border-slate-200 bg-slate-50 flex flex-col h-screen z-10 overflow-hidden relative">
    <!-- Scrollable Content -->
    <div class="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-5">
      <!-- Header: User Profile - Clickable -->
      <button
        @click="showProfileDropdown = !showProfileDropdown"
        class="w-full flex items-center justify-between mb-6 pt-1.5 hover:bg-slate-100 px-2 py-2 rounded-lg transition-colors text-left"
      >
        <div class="flex items-center space-x-3 min-w-0">
          <div class="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-inner flex-shrink-0">
            <User :size="18" />
          </div>
          <div class="min-w-0">
            <h2 class="text-sm font-bold text-slate-800 truncate">{{ appState.customerName || 'Guest User' }}</h2>
            <template v-if="appState.customerName">
              <div class="flex items-center text-[9px] font-bold tracking-tight text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit uppercase mt-0.5">
                <BadgeCheck :size="10" class="mr-1" /> Existing
              </div>
              <div class="text-[11px] text-slate-500 mt-1 flex items-center space-x-3">
                <span>Score: <strong class="text-slate-700">{{ appState.creditScore || '-' }}</strong></span>
                <span>Salary: <strong class="text-slate-700">{{ appState.salary ? `₹${Number(appState.salary).toLocaleString()}` : '-' }}</strong></span>
              </div>
            </template>
          </div>
        </div>
        <ChevronDown
          :size="16"
          class="text-slate-400 transition-transform flex-shrink-0"
          :class="{ 'rotate-180': showProfileDropdown }"
        />
      </button>

      <!-- Financial State -->
      <div class="mb-6">
        <div class="grid grid-cols-2 gap-2.5 mb-4">
          <MetricCard label="Principal" :value="appState.requestedAmount" prefix="₹" />
          <MetricCard label="Int. Rate" :value="appState.roi" :decimals="1" suffix="%" />
          <MetricCard label="Monthly EMI" :value="appState.emi" prefix="₹" />
          <MetricCard
            label="Est. Total Interest"
            :value="Math.max(0, (appState.emi * appState.tenure) - appState.requestedAmount)"
            prefix="₹"
          />
          <MetricCard label="Salary" :value="appState.salary || 0" prefix="₹" />
          <MetricCard label="Credit Score" :value="appState.creditScore || 0" />
        </div>

        <!-- Payment CTA -->
        <div
          v-if="appState.underwritingStatus === 'Approved' && appState.emi > 0"
          class="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100"
        >
          <div class="flex justify-between items-center mb-2">
            <span class="text-[10px] font-bold text-emerald-800 uppercase">Active Repayment</span>
            <span class="text-[10px] font-bold text-emerald-600">
              {{ appState.loan_terms?.payments_made || 0 }} / {{ appState.tenure }} Paid
            </span>
          </div>
          <button
            @click="onPayEmi?.()"
            class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold flex items-center justify-center transition-all shadow-sm"
          >
            <CreditCard :size="14" class="mr-2" /> Pay Next EMI
          </button>
        </div>
      </div>

      <!-- Underwriting Status -->
      <div class="mb-6">
        <div
          ref="badgeRef"
          class="px-2 py-1 rounded-md border flex items-center font-bold text-[10px] transition-colors shadow-sm"
          :class="{
            'bg-amber-50 border-amber-200 text-amber-700': appState.underwritingStatus === 'Pending Evaluation',
            'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-emerald-900/10': appState.underwritingStatus === 'Approved',
            'bg-red-50 border-red-200 text-red-700': appState.underwritingStatus === 'Soft-Rejected',
          }"
        >
          <Circle v-if="appState.underwritingStatus === 'Pending Evaluation'" :size="14" class="mr-1.5 animate-pulse" />
          <CheckCircle2 v-else-if="appState.underwritingStatus === 'Approved'" :size="14" class="mr-1.5" />
          <Circle v-else-if="appState.underwritingStatus === 'Soft-Rejected'" :size="14" class="mr-1.5" />
          {{ appState.underwritingStatus === 'Approved' ? 'High Approval Probability' : appState.underwritingStatus }}
        </div>
      </div>

      <!-- Past Sessions -->
      <div v-if="appState.pastLoans && appState.pastLoans.length > 0" class="mt-6 pt-5 border-t border-slate-200">
        <h3 class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-3">Past Loan History</h3>
        <div class="space-y-2.5">
          <div
            v-for="(loan, i) in appState.pastLoans.slice(0, 2)"
            :key="i"
            class="p-2.5 bg-slate-100/50 rounded-md border border-slate-200/60"
          >
            <div class="flex justify-between items-start mb-1.5">
              <span class="text-[10px] font-bold text-slate-700">₹{{ loan.amount?.toLocaleString() }} ({{ loan.type }})</span>
              <span
                class="text-[8px] px-1 py-0.5 rounded font-bold uppercase"
                :class="loan.decision === 'approve' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'"
              >
                {{ loan.decision }}
              </span>
            </div>
            <div class="text-[9px] text-slate-500 flex justify-between">
              <span>{{ new Date(loan.date).toLocaleDateString() }}</span>
              <a
                v-if="loan.sanction_letter"
                :href="loan.sanction_letter"
                target="_blank"
                class="text-emerald-600 font-bold hover:underline"
              >
                View
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Eligible Lenders -->
      <div v-if="appState.eligible_offers && appState.eligible_offers.length > 0" class="p-4 border-t border-slate-200">
        <h3 class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-3">Eligible Lenders</h3>
        <div class="space-y-2">
          <div
            v-for="offer in appState.eligible_offers"
            :key="offer.lender_id"
            class="flex items-center justify-between p-2 bg-white rounded-md border border-slate-100"
          >
            <div>
              <div class="text-[11px] font-bold text-slate-800">{{ offer.lender_name }}</div>
              <div class="text-[9px] text-slate-500">Rate: {{ offer.interest_rate }}% • EMI: ₹{{ Number(offer.emi).toLocaleString() }}</div>
            </div>
            <div>
              <button
                @click="onSelectLender?.(offer.lender_id)"
                class="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded"
              >
                Select
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="appState.pastRecords"
        class="px-3 py-2 bg-amber-50/50 rounded-lg border border-amber-100/50 italic text-[10px] text-amber-800 mb-3"
      >
        <strong>Note:</strong> {{ appState.pastRecords }}
      </div>
    </div>

    <!-- Profile Dropdown Modal - Previous Chats (Compact) -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="showProfileDropdown && appState.pastSessions && appState.pastSessions.length > 0"
        class="absolute top-[90px] left-5 w-56 max-h-96 bg-white rounded-lg border border-slate-200 shadow-lg z-50 overflow-y-auto"
      >
        <div class="sticky top-0 bg-white border-b border-slate-100 px-3 py-2 flex justify-between items-center">
          <h3 class="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Previous Chats</h3>
          <button
            @click="onNewChat?.()"
            class="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold hover:bg-emerald-700 transition-colors flex items-center"
          >
            <Plus :size="10" class="mr-0.5" /> New
          </button>
        </div>
        <div class="space-y-1.5 p-2">
          <div
            v-for="(session, i) in appState.pastSessions"
            :key="i"
            class="flex space-x-1.5 group"
          >
            <button
              @click="onLoadSession?.(session.session_id); showProfileDropdown = false"
              class="flex-1 text-left p-2 bg-slate-50 hover:bg-emerald-50 rounded-md border border-slate-150 transition-colors"
            >
              <div class="flex justify-between items-center mb-1">
                <span class="text-[9px] font-bold text-slate-900">
                  ₹{{ session.loan_amount ? (session.loan_amount / 100000).toFixed(1) : '0' }}L
                </span>
                <span class="text-[6px] font-bold text-slate-500 uppercase tracking-tight bg-slate-100 px-1 py-0.5 rounded">
                  {{ session.loan_type || 'Personal' }}
                </span>
              </div>
              <div class="text-[7px]">
                <span
                  class="inline-block px-1.5 py-0.5 rounded font-semibold"
                  :class="{
                    'bg-emerald-100 text-emerald-700': session.display_status === 'approved',
                    'bg-blue-100 text-blue-700': session.display_status === 'in_process',
                    'bg-red-100 text-red-700': session.display_status === 'rejected',
                    'bg-slate-100 text-slate-600': !session.display_status || session.display_status === 'pending',
                  }"
                >
                  {{
                    session.display_status === 'approved' ? 'Approved' :
                    session.display_status === 'in_process' ? 'In Process' :
                    session.display_status === 'rejected' ? 'Rejected' :
                    'Pending'
                  }}
                </span>
              </div>
            </button>
            <button
              @click.stop="handleDeleteChat(session.session_id)"
              class="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-all flex items-center justify-center border border-slate-150 bg-slate-50 hover:border-red-200"
              title="Delete Chat"
            >
              <Trash2 :size="12" />
            </button>
          </div>
        </div>

        <!-- KYC Documents in Profile Dropdown -->
        <div class="border-t border-slate-100 mt-2 pt-2">
          <h4 class="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">KYC Documents</h4>
          <div class="grid grid-cols-2 gap-1.5 px-2 pb-2">
            <div class="flex items-center justify-between p-1.5 bg-slate-50 rounded-md border border-slate-150">
              <div class="flex items-center text-[9px] font-bold text-slate-600 truncate mr-1">
                <FileText :size="10" class="mr-1 text-slate-400" /> PAN
              </div>
              <CheckCircle2
                v-if="appState.documents.pan === 'verified'"
                :size="12"
                class="text-emerald-500 flex-shrink-0"
              />
              <Circle v-else :size="12" class="text-slate-200 flex-shrink-0" />
            </div>
            <div class="flex items-center justify-between p-1.5 bg-slate-50 rounded-md border border-slate-150">
              <div class="flex items-center text-[9px] font-bold text-slate-600 truncate mr-1">
                <FileText :size="10" class="mr-1 text-slate-400" /> Income
              </div>
              <CheckCircle2
                v-if="appState.documents.bankStatement === 'verified'"
                :size="12"
                class="text-emerald-500 flex-shrink-0"
              />
              <Circle v-else :size="12" class="text-slate-200 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AppState } from '../types';
import {
  User,
  CheckCircle2,
  Circle,
  FileText,
  BadgeCheck,
  CreditCard,
  Trash2,
  Plus,
  ChevronDown,
} from '@lucide/vue';
import MetricCard from './MetricCard.vue';
import confetti from 'canvas-confetti';

const props = defineProps<{
  appState: AppState;
  onLoadSession?: (sessionId: string) => void;
  onNewChat?: () => void;
  onPayEmi?: () => void;
  onDeleteSession?: (sessionId: string) => void;
  onSelectLender?: (lenderId: string) => void;
}>();

const badgeRef = ref<HTMLDivElement | null>(null);
const showProfileDropdown = ref(false);

const handleDeleteChat = (sessionId: string) => {
  if (window.confirm('Delete this chat history?')) {
    props.onDeleteSession?.(sessionId);
  }
};

watch(
  () => props.appState.underwritingStatus,
  (newStatus) => {
    if (newStatus === 'Approved' && badgeRef.value) {
      const rect = badgeRef.value.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { x, y },
        colors: ['#10b981', '#34d399', '#059669', '#fbbf24'],
      });
    }
  }
);
</script>
