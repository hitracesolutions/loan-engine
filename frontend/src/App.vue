<template>
  <!-- Public: /docs route -->
  <div v-if="isDocsPath" class="min-h-screen bg-[#0A0A0A] text-white font-sans">
    <header class="border-b border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl flex items-center px-6 lg:px-10 h-16">
      <div class="flex items-center gap-3 cursor-pointer" @click="() => (window.location.href = '/')">
        <ShieldCheck class="w-6 h-6 text-emerald-400" />
        <span class="font-display font-bold text-xl">
          FinServe<span class="text-white/40">.AI</span>
        </span>
      </div>
    </header>
    <main class="py-24 px-6">
      <Docs />
    </main>
  </div>

  <!-- Unauthenticated: show landing page -->
  <LandingPage v-else-if="store.currentState === 'UNAUTHENTICATED'" />

  <!-- Authenticated: show dashboard + profile modal -->
  <template v-else>
    <DashboardLayout />
    <ProfileCompletionModal
      :is-open="showProfileCompletion"
      @completed="showProfileCompletion = false"
    />
  </template>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { ShieldCheck } from '@lucide/vue';
import { useLoanStore } from './stores/loanStore';
import { api } from './lib/api';

// ── Lazy-loaded page components ───────────────────────────────────────────────
import LandingPage from './components/LandingPage.vue';
import DashboardLayout from './components/workspace/layout/DashboardLayout.vue';
import ProfileCompletionModal from './components/auth/ProfileCompletionModal.vue';
import Docs from './pages/Docs.vue';

// ── Store ─────────────────────────────────────────────────────────────────────
const store = useLoanStore();
const { currentState } = storeToRefs(store);

// ── Local state ───────────────────────────────────────────────────────────────
const showProfileCompletion = ref(false);

// ── Routing helpers ───────────────────────────────────────────────────────────
const isDocsPath = computed(() => window.location.pathname === '/docs');

// ── OAuth callback handling (on mount, equivalent to React useEffect []) ──────
onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const name = params.get('name');
  const email = params.get('email');
  const picture = params.get('picture');
  const phone = params.get('phone');

  if (!sessionId) return;

  store.setSessionId(sessionId);

  try {
    const res = await api.verifySession(sessionId);

    if (res.success && res.data?.customer_data) {
      const cust = res.data.customer_data;
      const userObj = {
        name: cust.name || name || 'Borrower',
        email: cust.email || email || '',
        picture: cust.picture || picture || '',
        phone: cust.phone || phone || '',
        salary: cust.salary || 75000,
        city: cust.city || 'Mumbai',
        creditScore: cust.credit_score || 750,
        preApprovedLimit: cust.pre_approved_limit || 500000,
      };
      store.setUser(userObj);

      if (!userObj.phone || userObj.phone.startsWith('g_') || userObj.phone.length < 10) {
        showProfileCompletion.value = true;
      }
    } else if (name || email) {
      const userObj = {
        name: name || 'Borrower',
        email: email || '',
        picture: picture || '',
        phone: phone || '',
        salary: 75000,
        creditScore: 750,
      };
      store.setUser(userObj);
      if (!userObj.phone || userObj.phone.length < 10) {
        showProfileCompletion.value = true;
      }
    }
  } catch (err) {
    console.error('Session verification failed:', err);
  }

  // Clean up URL parameters
  window.history.replaceState({}, document.title, window.location.pathname);
});
</script>
