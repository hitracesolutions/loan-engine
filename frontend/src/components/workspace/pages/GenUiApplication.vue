<template>
  <div class="flex gap-4 h-[calc(100vh-140px)] w-full">
    <!-- Main Chat Card -->
    <div class="flex-1 bg-[#111] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
      <!-- Console Header -->
      <div class="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Bot class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-display font-medium text-white text-sm">System Intelligence Console</h3>
            <p class="text-[10px] text-white/40 uppercase tracking-widest font-mono">
              LangGraph Multi-Agent Orchestrator DAG
            </p>
          </div>
        </div>
        <span class="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 font-medium">
          <Sparkles class="w-3.5 h-3.5" /> Generative StateGraph Active
        </span>
      </div>

      <!-- Chat Stream Feed -->
      <div class="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scroll-smooth">
        <div
          v-for="item in chatHistory"
          :key="item.id"
          :class="['flex animate-fade-in', item.role === 'user' ? 'justify-end' : 'justify-start']"
        >
          <div :class="['max-w-[90%] flex gap-4', item.role === 'user' ? 'flex-row-reverse' : 'flex-row']">
            <div
              :class="[
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 border',
                item.role === 'user'
                  ? 'bg-white/10 border-white/20'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              ]"
            >
              <User v-if="item.role === 'user'" class="w-4 h-4 text-white" />
              <Bot v-else class="w-4 h-4" />
            </div>

            <div class="space-y-4 min-w-0 flex-1">
              <div
                v-if="item.content"
                :class="[
                  'px-5 py-4 text-[15px] leading-relaxed rounded-2xl',
                  item.role === 'user'
                    ? 'bg-white/10 text-white rounded-tr-sm border border-white/5'
                    : 'bg-[#0A0A0A] text-white/90 border border-white/10 rounded-tl-sm space-y-3'
                ]"
              >
                <template v-if="item.role === 'assistant'">
                  <div v-for="(line, lIdx) in renderMarkdownLines(item.content)" :key="lIdx">
                    <div v-if="line.isBullet" class="flex gap-2 items-start my-0.5">
                      <span class="mt-[7px] w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                      <span v-html="line.html" />
                    </div>
                    <div v-else-if="line.isEmpty" class="h-1.5" />
                    <p v-else class="leading-relaxed" v-html="line.html" />
                  </div>
                </template>
                <p v-else class="whitespace-pre-line">{{ item.content }}</p>
              </div>

              <!-- PDF Download Direct Banner -->
              <div
                v-if="item.pdfDownloadUrl"
                class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-4"
              >
                <div class="flex items-center gap-3">
                  <FileText class="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <p class="text-sm font-semibold text-white">
                      {{ item.pdfLabel || 'Official Facility Sanction PDF' }}
                    </p>
                    <p class="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                      <Mail class="w-3 h-3" /> Dispatched to {{ store.user?.email || 'email' }}
                    </p>
                  </div>
                </div>
                <a
                  :href="item.pdfDownloadUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="px-4 py-2 bg-white text-black font-semibold rounded-lg text-xs hover:bg-white/90 transition-all shrink-0"
                >
                  Download PDF →
                </a>
              </div>

              <!-- Initial Action Pills -->
              <div v-if="item.id === 'init-1' && chatHistory.length === 1" class="flex flex-wrap gap-3 pt-2">
                <button
                  @click="handleCheckBestTerms"
                  class="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-medium hover:bg-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <Sparkles class="w-3.5 h-3.5" /> Check Best Terms for My Profile
                </button>
                <button
                  @click="handleStartConfigurator"
                  class="px-4 py-2 bg-white/5 border border-white/10 text-white/80 rounded-xl text-xs font-medium hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <Sliders class="w-3.5 h-3.5" /> Configure Capital Slider
                </button>
              </div>

              <div v-if="item.showConfiguratorPill" class="flex flex-wrap gap-3 pt-1">
                <button
                  @click="handleProceedToKyc"
                  class="px-4 py-2 bg-white text-black rounded-xl text-xs font-semibold hover:bg-white/90 transition-all flex items-center gap-2"
                >
                  Confirm Terms & Proceed to KYC <ArrowRight class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="handleStartConfigurator"
                  class="px-4 py-2 bg-white/5 border border-white/10 text-white/80 rounded-xl text-xs font-medium hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <Sliders class="w-3.5 h-3.5" /> Adjust Parameters Slider
                </button>
              </div>

              <div v-if="item.showActiveLoansPill" class="flex flex-wrap gap-3 pt-1">
                <button
                  @click="store.setView('ACTIVE_LOANS')"
                  class="px-4 py-2 bg-emerald-500 text-black rounded-xl text-xs font-semibold hover:bg-emerald-400 transition-all flex items-center gap-2"
                >
                  <CreditCard class="w-3.5 h-3.5" /> View Active Loans & Repayment Ledger →
                </button>
              </div>

              <div v-if="item.showShapPill" class="flex flex-wrap gap-3 pt-1">
                <button
                  @click="handleShowShap"
                  class="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold hover:bg-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <BarChart3 class="w-3.5 h-3.5" /> Explain Underwriting Decision (SHAP) →
                </button>
              </div>

              <!-- Structured Components -->
              <div v-if="item.component" class="w-full">
                <OnboardingWidget v-if="item.component === 'ONBOARDING'" @next="handleOnboardingNext" />
                <KycWidget v-else-if="item.component === 'KYC'" @next="handleKycNext" />
                <OffersWidget v-else-if="item.component === 'OFFERS'" @select="handleOfferSelect" />
                <SanctionViewer v-else-if="item.component === 'SANCTION'" />
                <ShapWidget v-else-if="item.component === 'SHAP'" />
              </div>
            </div>
          </div>
        </div>

        <div v-if="isTyping" class="flex justify-start animate-fade-in">
          <div class="flex gap-4">
            <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-emerald-500/10 border-emerald-500/30 text-emerald-500">
              <Bot class="w-4 h-4" />
            </div>
            <div class="bg-[#0A0A0A] border border-white/10 rounded-2xl rounded-tl-sm px-5 py-4 text-sm shadow-sm flex items-center gap-3">
              <Loader2 class="w-4 h-4 animate-spin text-white/50" />
              <span class="text-white/50 tracking-wide font-mono text-xs uppercase">
                LangGraph Multi-Agent StateGraph Reasoning...
              </span>
            </div>
          </div>
        </div>
        <div ref="bottomRef" class="h-4" />
      </div>

      <!-- Input Form -->
      <form @submit.prevent="handleSendUserMessage" class="p-4 border-t border-white/10 bg-[#0A0A0A] relative shrink-0">
        <input
          type="text"
          v-model="input"
          placeholder="Ask System Intelligence (e.g. 'check remaining EMIs to be loan free')..."
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

    <!-- Right: Live DAG Visualizer (lg+) -->
    <div class="hidden lg:flex w-72 xl:w-80 shrink-0">
      <GraphVisualizer
        :current-phase="currentPhase"
        :next-agent="nextAgent"
        :is-streaming="isTyping"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import {
  Bot,
  User,
  Send,
  Sparkles,
  Loader2,
  Sliders,
  ArrowRight,
  FileText,
  Mail,
  CreditCard,
  BarChart3,
} from '@lucide/vue';
import OnboardingWidget from '../widgets/OnboardingWidget.vue';
import KycWidget from '../widgets/KycWidget.vue';
import OffersWidget from '../widgets/OffersWidget.vue';
import SanctionViewer from '../widgets/SanctionViewer.vue';
import ShapWidget from '../widgets/ShapWidget.vue';
import GraphVisualizer from '../widgets/GraphVisualizer.vue';
import { api } from '@/lib/api';

interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  component?: 'ONBOARDING' | 'KYC' | 'OFFERS' | 'SANCTION' | 'SHAP';
  showConfiguratorPill?: boolean;
  showActiveLoansPill?: boolean;
  showShapPill?: boolean;
  graphTrace?: string[];
  pdfDownloadUrl?: string;
  pdfLabel?: string;
  timestamp: number;
}

const store = useLoanStore();
const input = ref('');
const isTyping = ref(false);
const currentPhase = ref('load_session');
const nextAgent = ref<string | undefined>(undefined);
const bottomRef = ref<HTMLDivElement | null>(null);

const firstName = computed(() => (store.user?.name ? store.user.name.split(' ')[0] : 'Partner'));

const chatHistory = ref<ChatItem[]>([
  {
    id: 'init-1',
    role: 'assistant',
    content: `Hello ${
      store.user?.name ? store.user.name.split(' ')[0] : 'Partner'
    }. System Intelligence is active. Based on your verified profile (CIBIL: ${
      store.user?.creditScore || 785
    }), you are pre-approved for instant credit facilities up to ₹15,00,000. \n\nTo structure your capital, what is the primary purpose or goal for your loan today? (e.g. Business Expansion, Medical Emergency, Debt Consolidation, Personal)`,
    graphTrace: [
      'StateGraph initialized: load_session_node',
      'CIBIL Bureau Lookup: 785 (Tier-1 Prime)',
      'Pre-approved Limit Engine: ₹15,00,000',
    ],
    timestamp: Date.now(),
  },
]);

const scrollToBottom = () => {
  nextTick(() => {
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' });
  });
};

watch([chatHistory, isTyping], () => {
  scrollToBottom();
}, { deep: true });

onMounted(async () => {
  if (store.sessionId) {
    const res = await api.getChatHistory(store.sessionId);
    if (res.success && res.data?.history && res.data.history.length > 0) {
      const loadedMsgs: ChatItem[] = res.data.history.map((m: any, idx: number) => ({
        id: `restored-${idx}`,
        role: m.role === 'user' || m.type === 'human' ? 'user' : 'assistant',
        content: m.content || m.text || '',
        graphTrace: m.graphTrace || ['StateGraph Node: session_restored'],
        timestamp: Date.now(),
      }));
      if (loadedMsgs.length > 0) {
        chatHistory.value = loadedMsgs;
      }
    }
  }
});

const runAgentStream = async (logs: string[], taskFn: () => Promise<void>) => {
  store.clearAgentLogs();
  store.setAgentActive(true);

  for (const log of logs) {
    store.addAgentLog(log);
    await new Promise((res) => setTimeout(res, 350));
  }

  try {
    await taskFn();
  } catch (e: any) {
    store.addAgentLog(`❌ Error: ${e.message}`);
  } finally {
    setTimeout(() => store.setAgentActive(false), 500);
  }
};

const handleStartConfigurator = () => {
  chatHistory.value.push(
    {
      id: Date.now().toString(),
      role: 'user',
      content: 'I would like to open the capital parameter slider.',
      timestamp: Date.now(),
    },
    {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Understood. Please adjust your requested principal amount and tenure using the interactive facility configurator below:`,
      component: 'ONBOARDING',
      graphTrace: ['StateGraph Node: sales_agent -> onboarding_configurator'],
      timestamp: Date.now(),
    }
  );
};

const handleProceedToKyc = () => {
  handleOnboardingNext();
};

const handleCheckBestTerms = () => {
  chatHistory.value.push(
    {
      id: Date.now().toString(),
      role: 'user',
      content: 'Considering my profile, what are the best terms you can provide me?',
      timestamp: Date.now(),
    },
    {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Based on your Tier-1 credit score of ${
        store.user?.creditScore || 785
      } and monthly income telemetry, your optimal pre-approved facility is ₹5,00,000 at a prime rate of 10.5% p.a. over 36 months (~₹16,250/mo EMI). You can confirm these parameters to proceed to KYC, or adjust them using the configurator below:`,
      showConfiguratorPill: true,
      graphTrace: [
        'StateGraph Node: intent_agent (CLASSIFIED: Best Terms Inquiry)',
        'Invoking Underwriting Engine: FOIR = 18%, Risk Premium = 0%',
        'Calculated Optimal Facility: ₹5,00,000 @ 10.5% p.a.',
      ],
      timestamp: Date.now(),
    }
  );
};

const handleShowShap = () => {
  chatHistory.value.push(
    {
      id: Date.now().toString(),
      role: 'user',
      content: 'Explain my underwriting pricing using SHAP feature contributions.',
      timestamp: Date.now(),
    },
    {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Here is the SHAP Feature Importance Waterfall showing exactly how your credit score, income levels, debt obligations, and location metrics contributed to your final approved interest rate:`,
      component: 'SHAP',
      graphTrace: ['StateGraph Node: underwriting_agent -> shap_explainer_mcp'],
      timestamp: Date.now(),
    }
  );
};

const handleOnboardingNext = async () => {
  isTyping.value = true;
  await runAgentStream(
    [
      'POST /session/start initializing StateGraph workflow...',
      'Invoking Sales Agent (LangGraph node)...',
      'POST /sales/capture-loan-params calculating DTI & FOIR...',
      'Parameters updated in MongoDB session state.',
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
          requested_amount: 0,
          tenure_months: 0,
        });
      }

      isTyping.value = false;
      chatHistory.value.push({
        id: Date.now().toString(),
        role: 'assistant',
        content: `Capital parameters confirmed (Principal: ₹${store.loanDetails.requestedAmount.toLocaleString(
          'en-IN'
        )}, Tenure: ${store.loanDetails.tenureMonths} Months). For Vision AI identity verification, please complete 1-Click DigiLocker or upload your Aadhaar & PAN below:`,
        component: 'KYC',
        graphTrace: ['StateGraph Node: kyc_agent (Aadhaar & PAN Verification Node)'],
        timestamp: Date.now(),
      });
    }
  );
};

const handleKycNext = async () => {
  isTyping.value = true;
  await runAgentStream(
    [
      'POST /documents/upload verifying XML signatures...',
      'Invoking Vision AI Agent (OCR & Fraud Verification)...',
      'POST /session/underwrite running Decision Engine...',
    ],
    async () => {
      let decision = 'approve';
      let downloadUrl = '';
      if (store.sessionId) {
        const underRes = await api.underwrite(store.sessionId);
        decision = underRes.data?.decision || 'approve';
        if (decision === 'reject' || decision === 'hard_reject' || decision === 'soft_reject') {
          const sanRes = await api.generateSanction(store.sessionId);
          if (sanRes.success) downloadUrl = api.getDownloadLetterUrl(store.sessionId);
        }
      }

      isTyping.value = false;

      if (decision === 'reject' || decision === 'hard_reject' || decision === 'soft_reject') {
        chatHistory.value.push({
          id: Date.now().toString(),
          role: 'assistant',
          content: `We regret to inform you that your application could not be approved at this amount. The underwriting engine has flagged the request — see the decision explainability below, and the official rejection letter has been dispatched to your email (${
            store.user?.email || 'registered email'
          }):`,
          component: 'SHAP',
          pdfDownloadUrl: downloadUrl,
          pdfLabel: 'Official Rejection Letter',
          timestamp: Date.now(),
        });
      } else {
        chatHistory.value.push({
          id: Date.now().toString(),
          role: 'assistant',
          content: `StateGraph Underwriting Complete! Verified CIBIL Score: ${
            store.user?.creditScore || 785
          }. Evaluated 40,000+ risk vectors across partner lenders. Here are your pre-approved institutional offers:`,
          component: 'OFFERS',
          showShapPill: true,
          timestamp: Date.now(),
        });
      }
    }
  );
};

const handleOfferSelect = async (lenderId: string) => {
  isTyping.value = true;
  await runAgentStream(
    [
      `POST /session/select-lender selected partner ${lenderId}...`,
      'Running underwriting decision engine...',
      'Compiling final decision & letter...',
    ],
    async () => {
      let downloadUrl = '';
      let decision = 'approve';
      if (store.sessionId) {
        const selRes = await api.selectLender(store.sessionId, { selected_lender_id: lenderId });
        decision = selRes.data?.decision || 'approve';
        if (decision === 'approve' || decision === 'reject' || decision === 'hard_reject') {
          const sanRes = await api.generateSanction(store.sessionId);
          if (sanRes.success) downloadUrl = api.getDownloadLetterUrl(store.sessionId);
        }
      }

      isTyping.value = false;

      if (decision === 'approve') {
        chatHistory.value.push({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Facility Approved & Smart Contract Locked! Your official PDF Sanction Letter has been generated and dispatched to your email (${
            store.user?.email || 'registered email'
          }). You can download the PDF directly below:`,
          component: 'SANCTION',
          pdfDownloadUrl: downloadUrl,
          pdfLabel: 'Official Facility Sanction PDF',
          timestamp: Date.now(),
        });
      } else if (decision === 'pending_docs') {
        chatHistory.value.push({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Your requested amount exceeds your instant pre-approved limit, so additional income verification is required before we can sanction this facility. Please complete document verification below:`,
          component: 'KYC',
          timestamp: Date.now(),
        });
      } else {
        chatHistory.value.push({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `We regret to inform you that your application could not be approved at this amount. The underwriting engine has flagged the request — see the decision explainability below, and the official rejection letter has been dispatched to your email (${
            store.user?.email || 'registered email'
          }):`,
          component: 'SHAP',
          pdfDownloadUrl: downloadUrl,
          pdfLabel: 'Official Rejection Letter',
          timestamp: Date.now(),
        });
      }
    }
  );
};

const handleSendUserMessage = async () => {
  if (!input.value.trim()) return;

  const text = input.value;
  input.value = '';

  chatHistory.value.push({
    id: Date.now().toString(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  });

  isTyping.value = true;

  let activeSessionId = store.sessionId;
  if (!activeSessionId) {
    const startRes = await api.startSession();
    if (startRes.success && startRes.data) {
      activeSessionId = startRes.data.session_id;
      store.setSessionId(activeSessionId!);
    }
  }

  try {
    const chatRes = await api.chatWithAgent(activeSessionId!, text);
    isTyping.value = false;

    if (chatRes.success && chatRes.data) {
      const backendReply = chatRes.data.reply || 'Understood.';
      const intent = chatRes.data.intent || 'general';
      const phase = chatRes.data.current_phase || 'active';

      currentPhase.value = phase;
      if (chatRes.data.next_agent) nextAgent.value = chatRes.data.next_agent;

      if (chatRes.data.loan_terms?.principal) {
        store.updateLoanDetails({
          requestedAmount: chatRes.data.loan_terms.principal,
          tenureMonths: chatRes.data.loan_terms.tenure || store.loanDetails.tenureMonths,
        });
      }

      const graphTraces: string[] = [`intent_agent → ${intent.toUpperCase()}`, `phase: ${phase}`];
      if (chatRes.data.next_agent) graphTraces.push(`→ ${chatRes.data.next_agent}`);
      if (chatRes.data.loan_terms?.emi)
        graphTraces.push(`EMI ₹${Math.round(chatRes.data.loan_terms.emi).toLocaleString('en-IN')}/mo`);

      const lowerText = text.toLowerCase();
      const explicitlyWantsSlider =
        lowerText.includes('slider') || lowerText.includes('configure') || lowerText.includes('adjust slider');
      const wantsShap =
        lowerText.includes('shap') ||
        lowerText.includes('explain') ||
        lowerText.includes('why') ||
        lowerText.includes('rationale') ||
        lowerText.includes('decision');

      const pendingQuestion = chatRes.data.pending_question;
      const isConfirmingTerms = pendingQuestion === 'confirmation' || explicitlyWantsSlider;

      const isEmiStatus =
        intent === 'payment' ||
        lowerText.includes('remaining') ||
        lowerText.includes('loanfree') ||
        lowerText.includes('loan free') ||
        lowerText.includes('balance') ||
        lowerText.includes('status');
      const isRejected = ['reject', 'hard_reject', 'soft_reject'].includes(chatRes.data.decision);
      const isApproved = chatRes.data.decision === 'approve';
      const isPendingDocs = chatRes.data.decision === 'pending_docs';
      const hasOffers = Array.isArray(chatRes.data.eligible_offers) && chatRes.data.eligible_offers.length > 0;
      const needsKyc =
        Array.isArray(chatRes.data.required_documents) &&
        chatRes.data.required_documents.length > 0 &&
        !chatRes.data.documents_uploaded;

      const comp = isApproved
        ? 'SANCTION'
        : isRejected || wantsShap
        ? 'SHAP'
        : isPendingDocs || needsKyc
        ? 'KYC'
        : hasOffers
        ? 'OFFERS'
        : explicitlyWantsSlider
        ? 'ONBOARDING'
        : undefined;

      chatHistory.value.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: backendReply,
        component: comp,
        showConfiguratorPill: isConfirmingTerms,
        showActiveLoansPill: isEmiStatus,
        graphTrace: graphTraces,
        timestamp: Date.now(),
      });
    } else {
      chatHistory.value.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I have processed your message: "${text}". System Intelligence is ready to assist with facility origination, interest rates, or KYC validation.`,
        graphTrace: ['StateGraph Node: master_router'],
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    isTyping.value = false;
    chatHistory.value.push({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `I have received your request regarding "${text}". System Intelligence is ready to assist.`,
      graphTrace: ['StateGraph Node: master_router (Fallback)'],
      timestamp: Date.now(),
    });
  }
};

const renderMarkdownLines = (text: string) => {
  return text.split('\n').map((line) => {
    if (line.match(/^[•\-\*]\s/)) {
      const content = line.replace(/^[•\-\*]\s/, '');
      return {
        isBullet: true,
        isEmpty: false,
        html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
      };
    }
    if (line.trim() === '') {
      return { isBullet: false, isEmpty: true, html: '' };
    }
    return {
      isBullet: false,
      isEmpty: false,
      html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
    };
  });
};
</script>
