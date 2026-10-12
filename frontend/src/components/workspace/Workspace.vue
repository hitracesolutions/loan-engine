<template>
  <div class="fixed inset-0 flex w-full bg-[#0A0A0A] text-white selection:bg-white/20 font-sans overflow-hidden">
    <!-- Background Effects matching Landing Page -->
    <div class="absolute inset-0 z-0 pointer-events-none">
      <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px]" />
      <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/5 blur-[120px]" />
    </div>

    <main class="flex-1 flex flex-col h-full relative z-10 max-w-4xl mx-auto w-full border-x border-white/[0.05] bg-[#0A0A0A]/50 backdrop-blur-xl shadow-2xl">
      <!-- Header -->
      <header class="h-20 border-b border-white/[0.05] bg-[#0A0A0A]/80 backdrop-blur-xl flex items-center justify-between px-8 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ShieldCheck class="w-5 h-5 text-white" />
          </div>
          <div>
            <span class="font-display font-medium text-lg tracking-tight block leading-tight">
              FinServe<span class="text-white/40">.AI</span>
            </span>
            <span class="text-xs text-white/40 font-medium tracking-widest uppercase">System Intelligence</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span class="text-xs text-emerald-500/80 uppercase tracking-widest font-semibold">Online</span>
        </div>
      </header>

      <!-- Chat Feed -->
      <div class="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scroll-smooth">
        <div v-if="store.chatHistory.length === 0 && !isTyping" class="text-center mt-20 opacity-30">
          <Bot class="w-12 h-12 mx-auto mb-4 text-white" />
          <p class="text-sm font-medium tracking-widest uppercase">System Initializing</p>
        </div>

        <div
          v-for="msg in store.chatHistory"
          :key="msg.id"
          :class="['flex animate-fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start']"
        >
          <div :class="['max-w-[85%] flex gap-4', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row']">
            <div
              :class="[
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 border',
                msg.role === 'user'
                  ? 'bg-white/10 border-white/20'
                  : 'bg-emerald-500/10 border-emerald-500/30'
              ]"
            >
              <User v-if="msg.role === 'user'" class="w-4 h-4 text-white/70" />
              <Bot v-else class="w-4 h-4 text-emerald-500" />
            </div>

            <div class="flex flex-col gap-3 min-w-0">
              <div
                v-if="msg.content"
                :class="[
                  'px-5 py-3.5 text-[15px] leading-relaxed rounded-2xl shadow-sm',
                  msg.role === 'user'
                    ? 'bg-white/10 text-white rounded-tr-sm border border-white/5'
                    : 'bg-[#111] text-white/90 border border-white/10 rounded-tl-sm'
                ]"
              >
                {{ msg.content }}
              </div>

              <div v-if="msg.component" class="mt-2 w-full">
                <ProfileWidget v-if="msg.component === 'PROFILE_FORM'" />
                <OnboardingWidget v-else-if="msg.component === 'ONBOARDING_FORM'" />
                <KycWidget v-else-if="msg.component === 'KYC_DROPZONE'" />
                <OffersWidget v-else-if="msg.component === 'LENDER_CAROUSEL'" />
                <ActiveContractWidget v-else-if="msg.component === 'ACTIVE_CONTRACT'" />
                <RejectionWidget v-else-if="msg.component === 'SHAP_EXPLANATION'" />
              </div>
            </div>
          </div>
        </div>

        <div v-if="isTyping" class="flex justify-start animate-fade-in">
          <div class="flex gap-4">
            <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-emerald-500/10 border-emerald-500/30">
              <Bot class="w-4 h-4 text-emerald-500" />
            </div>
            <div class="bg-[#111] border border-white/10 rounded-2xl rounded-tl-sm px-5 py-4 text-sm shadow-sm flex items-center gap-3">
              <Loader2 class="w-4 h-4 animate-spin text-white/50" />
              <span class="text-white/50 tracking-wide font-medium text-xs uppercase">Processing</span>
            </div>
          </div>
        </div>
        <div ref="bottomRef" class="h-4" />
      </div>

      <!-- Input Area -->
      <div class="p-6 bg-[#0A0A0A]/90 border-t border-white/[0.05] backdrop-blur-md">
        <form @submit.prevent="handleSend" class="relative max-w-3xl mx-auto">
          <input
            type="text"
            v-model="input"
            placeholder="Ask System Intelligence to adjust parameters..."
            class="w-full bg-[#111] border border-white/10 rounded-xl pl-5 pr-14 py-4 text-[15px] focus:outline-none focus:ring-1 focus:ring-white/30 shadow-inner text-white placeholder:text-white/30 transition-all"
          />
          <button
            type="submit"
            :disabled="!input.trim()"
            class="absolute right-2 top-2 bottom-2 w-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30 transition-all"
          >
            <Send class="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import { ShieldCheck, Bot, User, Send, Loader2 } from '@lucide/vue';
import ProfileWidget from './widgets/ProfileWidget.vue';
import OnboardingWidget from './widgets/OnboardingWidget.vue';
import KycWidget from './widgets/KycWidget.vue';
import OffersWidget from './widgets/OffersWidget.vue';
import ActiveContractWidget from './widgets/ActiveContractWidget.vue';
import RejectionWidget from './widgets/RejectionWidget.vue';

const store = useLoanStore();
const input = ref('');
const isTyping = ref(false);
const bottomRef = ref<HTMLDivElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' });
  });
};

watch([() => store.chatHistory.length, isTyping], () => {
  scrollToBottom();
});

// State Machine Driven Chat Injection
watch(
  () => store.currentState,
  (state) => {
    const lastMsg = store.chatHistory[store.chatHistory.length - 1];

    if (state === 'PROFILE_COMPLETION' && lastMsg?.component !== 'PROFILE_FORM') {
      isTyping.value = true;
      setTimeout(() => {
        isTyping.value = false;
        store.addChatMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: `Welcome to FinServe, ${store.user?.name || 'User'}. To initialize your cryptographic profile, please verify the following details:`,
          timestamp: Date.now(),
          component: 'PROFILE_FORM',
        });
      }, 1000);
    } else if (
      state === 'ONBOARDING' &&
      lastMsg?.component !== 'ONBOARDING_FORM' &&
      !store.chatHistory.find((m) => m.component === 'ONBOARDING_FORM')
    ) {
      isTyping.value = true;
      setTimeout(() => {
        isTyping.value = false;
        store.addChatMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: `Identity verified. Your credit profile is active (Score: ${store.user?.creditScore || 785}). Please set your capital requirements below:`,
          timestamp: Date.now(),
          component: 'ONBOARDING_FORM',
        });
      }, 1000);
    } else if (
      state === 'DOCUMENT_COLLECTION' &&
      lastMsg?.component !== 'KYC_DROPZONE' &&
      !store.chatHistory.find((m) => m.component === 'KYC_DROPZONE')
    ) {
      isTyping.value = true;
      setTimeout(() => {
        isTyping.value = false;
        store.addChatMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Capital parameters accepted. For sub-second underwriting, please upload your Aadhaar and PAN documents below.',
          timestamp: Date.now(),
          component: 'KYC_DROPZONE',
        });
      }, 1000);
    } else if (
      state === 'DECISION_READY' &&
      lastMsg?.component !== 'LENDER_CAROUSEL' &&
      !store.chatHistory.find((m) => m.component === 'LENDER_CAROUSEL')
    ) {
      isTyping.value = true;
      setTimeout(() => {
        isTyping.value = false;
        store.addChatMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: 'StateGraph underwriting complete. Analyzing 40,000+ data points... Here are your verified institutional offers:',
          timestamp: Date.now(),
          component: 'LENDER_CAROUSEL',
        });
      }, 2000);
    } else if (
      state === 'ACTIVE_LOAN' &&
      lastMsg?.component !== 'ACTIVE_CONTRACT' &&
      !store.chatHistory.find((m) => m.component === 'ACTIVE_CONTRACT')
    ) {
      isTyping.value = true;
      setTimeout(() => {
        isTyping.value = false;
        store.addChatMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Smart contract executed. Funds are being disbursed to your account. Your active facility ledger is available below:',
          timestamp: Date.now(),
          component: 'ACTIVE_CONTRACT',
        });
      }, 1000);
    }
  },
  { immediate: true }
);

const handleSend = () => {
  if (!input.value.trim()) return;

  store.addChatMessage({
    id: Date.now().toString(),
    role: 'user',
    content: input.value,
    timestamp: Date.now(),
  });

  input.value = '';
  isTyping.value = true;

  setTimeout(() => {
    isTyping.value = false;
    store.addChatMessage({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Understood. Modifying parameters via StateGraph engine...',
      timestamp: Date.now(),
    });
  }, 1500);
};
</script>
