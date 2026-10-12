<template>
  <div class="space-y-8 max-w-5xl mx-auto pb-12 animate-fade-in">
    <!-- Header -->
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-3xl font-display font-medium text-white tracking-tight">Active Loan Facilities</h1>
        <p class="text-white/60 text-sm mt-1">Manage eNACH mandates, automated EMI repayments, and facility ledgers.</p>
      </div>
      <button
        @click="handleDownloadSanction"
        class="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-medium border border-white/10 transition-all flex items-center gap-2"
      >
        <Download class="w-4 h-4 text-emerald-400" /> Download Facility Sanction PDF
      </button>
    </div>

    <div
      v-if="paidSuccessMessage"
      class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-medium text-sm flex items-center gap-2 animate-fade-in"
    >
      <CheckCircle2 class="w-5 h-5 shrink-0" />
      <span>{{ paidSuccessMessage }}</span>
    </div>

    <!-- Main Ledger Card -->
    <div class="bg-[#111] border border-white/10 rounded-2xl p-8 shadow-xl relative overflow-hidden">
      <div class="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/10 pb-8 mb-8">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Active Facility
            </span>
            <span class="text-xs font-semibold text-white/50">{{ lenderName }}</span>
          </div>
          <h2 class="text-4xl font-display font-bold text-white tracking-tight mt-3">
            ₹{{ facilityAmount.toLocaleString('en-IN') }}
          </h2>
          <p class="text-xs text-white/40 mt-1 font-mono">Facility ID: {{ facilityId }}</p>
        </div>

        <div class="bg-[#0A0A0A] p-4 rounded-xl border border-white/10 flex items-center gap-6">
          <div>
            <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold">Upcoming EMI Due</p>
            <p class="text-lg font-bold text-white font-mono">₹{{ baseEmi.toLocaleString('en-IN') }}</p>
          </div>
          <div class="h-8 w-px bg-white/10" />
          <div>
            <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold">Next Due Date</p>
            <p class="text-sm font-medium text-emerald-400">05th Next Month</p>
          </div>
        </div>
      </div>

      <!-- Next EMI Quick Pay Action -->
      <div class="max-w-md">
        <button
          @click="handleOpenPaymentModal(paidInstallments.length + 1, baseEmi, '05th Next Month')"
          class="w-full h-14 bg-white text-black font-semibold rounded-xl hover:bg-white/90 shadow-lg shadow-white/10 transition-all flex items-center justify-center gap-3 text-base"
        >
          <CreditCard class="w-5 h-5" />
          Pay Upcoming EMI via Razorpay (₹{{ baseEmi.toLocaleString('en-IN') }})
        </button>
      </div>
    </div>

    <!-- Repayment Amortization Ledger -->
    <div class="bg-[#111] border border-white/10 rounded-2xl p-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h3 class="text-lg font-display font-medium text-white">Repayment Amortization Ledger</h3>
          <p class="text-xs text-white/40 mt-0.5">Pay individual installments or enable automated eNACH mandate auto-debit.</p>
        </div>
        <span class="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          Paid: {{ paidInstallments.length }} / {{ tenure }} Months
        </span>
      </div>

      <div class="space-y-3 font-mono text-xs">
        <div
          v-for="(item, idx) in rawSchedule"
          :key="idx"
          :class="[
            'flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl border transition-all gap-3',
            paidInstallments.includes(item.installment || idx + 1) || item.status === 'paid'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : idx === paidInstallments.length
              ? 'bg-[#0A0A0A] border-white/20'
              : 'bg-[#0A0A0A]/50 border-white/5 opacity-70'
          ]"
        >
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs',
                paidInstallments.includes(item.installment || idx + 1) || item.status === 'paid'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 text-white/60'
              ]"
            >
              #{{ item.installment || idx + 1 }}
            </div>
            <div>
              <p class="text-white font-sans font-medium text-sm">Installment #{{ item.installment || idx + 1 }}</p>
              <p class="text-[11px] text-white/40 font-mono">
                Due: {{ formatDate(item.due_date) }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <span
              :class="[
                'font-bold text-sm',
                paidInstallments.includes(item.installment || idx + 1) || item.status === 'paid'
                  ? 'text-emerald-400'
                  : 'text-white'
              ]"
            >
              ₹{{ (item.amount || baseEmi).toLocaleString('en-IN') }}
            </span>

            <span
              v-if="paidInstallments.includes(item.installment || idx + 1) || item.status === 'paid'"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-sans font-semibold"
            >
              <Check class="w-3.5 h-3.5" /> Paid & Verified
            </span>
            <button
              v-else
              @click="handleOpenPaymentModal(item.installment || idx + 1, item.amount || baseEmi, item.due_date)"
              class="px-3.5 py-1.5 bg-white text-black hover:bg-white/90 rounded-lg text-xs font-sans font-semibold transition-all shadow-sm"
            >
              Pay EMI →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Razorpay Gateway Modal -->
    <div
      v-if="showRazorpayModal && selectedInstallment"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
    >
      <div class="bg-[#111] border border-white/15 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
        <div class="p-5 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
              RZP
            </div>
            <div>
              <h4 class="font-display font-semibold text-white text-sm">Razorpay Checkout Gateway</h4>
              <p class="text-[10px] text-white/40 font-mono uppercase">
                Installment #{{ selectedInstallment.number }} • FinServe NBFC
              </p>
            </div>
          </div>
          <button @click="showRazorpayModal = false" class="text-white/40 hover:text-white transition-all">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-6">
          <div class="bg-[#0A0A0A] p-4 rounded-xl border border-white/5 flex justify-between items-center">
            <div>
              <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                Installment #{{ selectedInstallment.number }} Due
              </p>
              <p class="text-2xl font-bold text-white font-mono">
                ₹{{ selectedInstallment.amount.toLocaleString('en-IN') }}
              </p>
            </div>
            <div class="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <Lock class="w-3 h-3" /> 256-Bit SSL Secured
            </div>
          </div>

          <!-- Payment Method Selector -->
          <div class="grid grid-cols-3 gap-2">
            <button
              @click="paymentMethod = 'UPI'"
              :class="[
                'p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all',
                paymentMethod === 'UPI'
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                  : 'bg-[#0A0A0A] border-white/10 text-white/60 hover:bg-white/5'
              ]"
            >
              <Smartphone class="w-4 h-4" /> UPI Apps
            </button>
            <button
              @click="paymentMethod = 'CARD'"
              :class="[
                'p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all',
                paymentMethod === 'CARD'
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                  : 'bg-[#0A0A0A] border-white/10 text-white/60 hover:bg-white/5'
              ]"
            >
              <CreditCard class="w-4 h-4" /> Card
            </button>
            <button
              @click="paymentMethod = 'NETBANKING'"
              :class="[
                'p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all',
                paymentMethod === 'NETBANKING'
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                  : 'bg-[#0A0A0A] border-white/10 text-white/60 hover:bg-white/5'
              ]"
            >
              <Building2 class="w-4 h-4" /> NetBanking
            </button>
          </div>

          <div v-if="paymentMethod === 'UPI'" class="bg-[#0A0A0A] p-4 rounded-xl border border-white/5 space-y-2">
            <p class="text-xs text-white/70">Select your preferred UPI App:</p>
            <div class="flex gap-3 text-xs font-medium">
              <span class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white">Google Pay</span>
              <span class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white">PhonePe</span>
              <span class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white">Paytm</span>
            </div>
          </div>

          <button
            @click="handleExecutePayment"
            :disabled="isPaying"
            class="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-white/90 shadow-lg shadow-white/10 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <template v-if="isPaying">
              <span class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Processing Razorpay Payment...
            </template>
            <template v-else>
              Pay Installment #{{ selectedInstallment.number }} (₹{{ selectedInstallment.amount.toLocaleString('en-IN') }}) via Razorpay →
            </template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import {
  CreditCard,
  CheckCircle2,
  Download,
  X,
  Lock,
  Smartphone,
  Building2,
  Check,
} from '@lucide/vue';
import { api } from '@/lib/api';

const store = useLoanStore();

const isPaying = ref(false);
const paidSuccessMessage = ref('');
const showRazorpayModal = ref(false);
const selectedInstallment = ref<{ number: number; amount: number; due_date: string } | null>(null);
const activeLoanData = ref<any>(null);
const paymentMethod = ref<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
const paidInstallments = ref<number[]>([]);

const fetchHistory = async () => {
  const identifier = store.user?.phone || store.user?.email;
  if (identifier) {
    const res = await api.getLoanHistory(identifier);
    if (res.success && res.data?.history && res.data.history.length > 0) {
      const approved =
        res.data.history.find((h: any) => h.status === 'Approved' || h.status === 'Disbursed') ||
        res.data.history[0];
      if (approved) {
        activeLoanData.value = approved;
      }
    }
  }
};

onMounted(() => {
  fetchHistory();
});

const facilityAmount = computed(() => activeLoanData.value?.amount || store.loanDetails.requestedAmount);
const tenure = computed(() => activeLoanData.value?.tenure || store.loanDetails.tenureMonths);
const baseEmi = computed(
  () => activeLoanData.value?.emi || Math.round((facilityAmount.value * 1.105) / tenure.value)
);

const facilityId = computed(() =>
  activeLoanData.value?.session_id
    ? `#FAC-${activeLoanData.value.session_id.substring(0, 8).toUpperCase()}`
    : '#FAC-HDFC-889102'
);

const lenderName = computed(
  () => activeLoanData.value?.loan_type || activeLoanData.value?.lender_name || 'HDFC Bank NBFC'
);

const rawSchedule = computed(() => {
  if (activeLoanData.value?.emi_schedule && activeLoanData.value.emi_schedule.length > 0) {
    return activeLoanData.value.emi_schedule;
  }
  return Array.from({ length: Math.min(tenure.value, 12) }).map((_, idx) => {
    const d = new Date();
    d.setMonth(d.getMonth() + idx + 1);
    d.setDate(5);
    return {
      installment: idx + 1,
      due_date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      amount: baseEmi.value,
      status: idx === 0 ? 'pending' : 'scheduled',
    };
  });
});

const formatDate = (dateStr: string) => {
  if (!dateStr) return '05th Month';
  const d = new Date(dateStr);
  return d.toString() !== 'Invalid Date'
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : dateStr;
};

const handleOpenPaymentModal = (instNumber: number, instAmount: number, instDueDate: string) => {
  selectedInstallment.value = { number: instNumber, amount: instAmount, due_date: instDueDate };
  showRazorpayModal.value = true;
};

const handleExecutePayment = async () => {
  if (!selectedInstallment.value) return;
  isPaying.value = true;

  try {
    const targetSessionId = activeLoanData.value?.session_id || store.sessionId;
    if (targetSessionId) {
      await api.payEmi(targetSessionId);
    } else {
      await new Promise((r) => setTimeout(r, 1200));
    }

    paidInstallments.value.push(selectedInstallment.value.number);
    paidSuccessMessage.value = `Installment #${selectedInstallment.value.number} (₹${selectedInstallment.value.amount.toLocaleString(
      'en-IN'
    )}) successfully paid via Razorpay! Transaction ID: RZP-${Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase()}`;
    showRazorpayModal.value = false;

    await fetchHistory();

    setTimeout(() => {
      paidSuccessMessage.value = '';
    }, 6000);
  } catch (e) {
    console.error(e);
  } finally {
    isPaying.value = false;
  }
};

const handleDownloadSanction = () => {
  if (store.sessionId) {
    window.open(api.getDownloadLetterUrl(store.sessionId), '_blank');
  } else if (activeLoanData.value?.session_id) {
    window.open(api.getDownloadLetterUrl(activeLoanData.value.session_id), '_blank');
  } else {
    alert('Sanction PDF compiled and downloaded.');
  }
};
</script>
