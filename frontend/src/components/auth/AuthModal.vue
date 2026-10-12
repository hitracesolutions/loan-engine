<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
    <div class="bg-[#111] border border-white/10 rounded-2xl max-w-md w-full p-8 shadow-2xl relative overflow-hidden text-white">
      <!-- Close Button -->
      <button
        @click="$emit('close')"
        class="absolute top-4 right-4 p-2 text-white/40 hover:text-white rounded-lg transition-colors"
      >
        <X class="w-5 h-5" />
      </button>

      <!-- Modal Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
          <ShieldCheck class="w-5 h-5" />
        </div>
        <div>
          <h3 class="font-display font-medium text-xl tracking-tight">Access FinServe<span class="text-white/40">.AI</span></h3>
          <p class="text-xs text-white/40">Autonomous Institutional Lending Platform</p>
        </div>
      </div>

      <!-- Google OAuth Button -->
      <button
        @click="handleGoogleOAuth"
        class="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-3 mb-6 shadow-sm"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.6 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
          <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.4 0 15.2s.7 5.5 1.9 7.9l3.7-2.9c-.6-1.1-1-2.4-1-3.7z" />
          <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z" />
        </svg>
        Continue with Google OAuth
      </button>

      <div class="relative flex items-center justify-center mb-6">
        <div class="border-t border-white/10 w-full" />
        <span class="bg-[#111] px-3 text-[10px] uppercase tracking-widest text-white/40 font-bold shrink-0">Or Instant Authentication</span>
        <div class="border-t border-white/10 w-full" />
      </div>

      <!-- Mode Switcher -->
      <div class="flex bg-[#0A0A0A] p-1 rounded-xl border border-white/10 mb-6">
        <button
          @click="mode = 'LOGIN'; error = null;"
          :class="[
            'flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
            mode === 'LOGIN' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white'
          ]"
        >
          Sign In
        </button>
        <button
          @click="mode = 'REGISTER'; error = null;"
          :class="[
            'flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
            mode === 'REGISTER' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white'
          ]"
        >
          Register
        </button>
      </div>

      <div v-if="error" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
        {{ error }}
      </div>

      <!-- PASSWORD LOGIN FORM -->
      <form v-if="mode === 'LOGIN'" @submit.prevent="handleLoginSubmit" class="space-y-4">
        <div>
          <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Email or Phone Number</label>
          <div class="relative">
            <Mail class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
            <input
              required
              type="text"
              v-model="loginPhone"
              placeholder="rahul@example.com or 99999 99999"
              class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
            />
          </div>
        </div>

        <div>
          <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Password</label>
          <div class="relative">
            <Lock class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
            <input
              required
              type="password"
              v-model="loginPassword"
              placeholder="••••••••"
              class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
            />
          </div>
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full h-12 mt-2 bg-white text-black font-semibold rounded-xl hover:bg-white/90 shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
        >
          {{ loading ? 'Authenticating...' : 'Sign In to Dashboard' }}
          <ArrowRight class="w-4 h-4" />
        </button>
      </form>

      <!-- REGISTER FORM -->
      <form v-else @submit.prevent="handleRegisterSubmit" class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div>
          <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Full Name</label>
          <div class="relative">
            <User class="w-4 h-4 text-white/30 absolute left-3 top-3" />
            <input
              required
              type="text"
              v-model="regName"
              placeholder="Rahul Sharma"
              class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Email</label>
            <div class="relative">
              <Mail class="w-3.5 h-3.5 text-white/30 absolute left-3 top-3" />
              <input
                required
                type="email"
                v-model="regEmail"
                placeholder="rahul@example.com"
                class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
              />
            </div>
          </div>

          <div>
            <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Phone</label>
            <div class="relative">
              <Phone class="w-3.5 h-3.5 text-white/30 absolute left-3 top-3" />
              <input
                required
                type="tel"
                v-model="regPhone"
                placeholder="9999999999"
                class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
              />
            </div>
          </div>
        </div>

        <div>
          <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Password</label>
          <div class="relative">
            <Lock class="w-3.5 h-3.5 text-white/30 absolute left-3 top-3" />
            <input
              required
              type="password"
              v-model="regPassword"
              placeholder="••••••••"
              class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Monthly Salary</label>
            <div class="relative">
              <Briefcase class="w-3.5 h-3.5 text-white/30 absolute left-3 top-3" />
              <input
                required
                type="number"
                v-model="regSalary"
                placeholder="150000"
                class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
              />
            </div>
          </div>

          <div>
            <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">City</label>
            <div class="relative">
              <MapPin class="w-3.5 h-3.5 text-white/30 absolute left-3 top-3" />
              <input
                required
                type="text"
                v-model="regCity"
                placeholder="Bengaluru"
                class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full h-11 mt-2 bg-white text-black font-semibold rounded-xl hover:bg-white/90 shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
        >
          {{ loading ? 'Creating MongoDB Record...' : 'Complete Registration' }}
          <ArrowRight class="w-4 h-4" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { api } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { useLoanStore } from '@/stores/loanStore';
import { X, Lock, Phone, User, Mail, MapPin, Briefcase, ShieldCheck, ArrowRight } from '@lucide/vue';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const store = useLoanStore();

const mode = ref<'LOGIN' | 'REGISTER'>('LOGIN');
const loading = ref(false);
const error = ref<string | null>(null);

// Login fields
const loginPhone = ref('');
const loginPassword = ref('');

// Register fields
const regName = ref('');
const regEmail = ref('');
const regPhone = ref('');
const regPassword = ref('');
const regCity = ref('');
const regSalary = ref('');
const regDob = ref('');
const regProfession = ref('Salaried');

const handleGoogleOAuth = () => {
  window.location.href = `${API_BASE}/auth/google/login`;
};

const handleLoginSubmit = async () => {
  error.value = null;
  loading.value = true;

  const res = await api.loginWithPassword(loginPhone.value, loginPassword.value);
  loading.value = false;

  if (res.success && res.data) {
    const cust = res.data.customer_data || {};
    if (res.data.session_id) {
      store.setSessionId(res.data.session_id);
    }
    store.setUser({
      name: cust.name || 'Sarang Rao',
      email: cust.email || 'sarang@nbfc-finserve.com',
      picture: cust.picture || '',
      phone: cust.phone || loginPhone.value,
      salary: cust.salary || 150000,
      city: cust.city || 'Mumbai',
      creditScore: cust.credit_score || 800,
    });
    const targetView = localStorage.getItem('postAuthView');
    if (targetView) {
      store.setView(targetView as any);
      localStorage.removeItem('postAuthView');
    }
    emit('close');
  } else {
    error.value = res.error || 'Invalid credentials';
  }
};

const handleRegisterSubmit = async () => {
  error.value = null;
  loading.value = true;

  const res = await api.registerCustomer({
    name: regName.value,
    email: regEmail.value,
    phone: regPhone.value,
    password: regPassword.value,
    city: regCity.value,
    salary: Number(regSalary.value),
    dob: regDob.value,
    profession: regProfession.value,
  });
  loading.value = false;

  if (res.success && res.data) {
    const cust = res.data.customer_data || {};
    if (res.data.session_id) {
      store.setSessionId(res.data.session_id);
    }
    store.setUser({
      name: cust.name || regName.value,
      email: cust.email || regEmail.value,
      picture: '',
      phone: cust.phone || regPhone.value,
      salary: cust.salary || Number(regSalary.value),
      city: cust.city || regCity.value,
      creditScore: cust.credit_score || 785,
    });
    const targetView = localStorage.getItem('postAuthView');
    if (targetView) {
      store.setView(targetView as any);
      localStorage.removeItem('postAuthView');
    }
    emit('close');
  } else {
    error.value = res.error || 'Registration failed';
  }
};
</script>
