<template>
  <div class="space-y-8 max-w-4xl mx-auto pb-12 animate-fade-in">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-display font-medium text-white tracking-tight">Verified Borrower Profile</h1>
      <p class="text-white/60 text-sm mt-1">Manage institutional credit telemetry, verified income, and linked account settings.</p>
    </div>

    <!-- Main Profile Card Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Left Telemetry Card -->
      <div class="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-6">
        <div class="flex flex-col items-center text-center space-y-3 pb-6 border-b border-white/10">
          <div class="w-20 h-20 rounded-full bg-white/10 border-2 border-emerald-500/40 p-1 flex items-center justify-center overflow-hidden relative group">
            <img
              v-if="picture || store.user?.picture"
              :src="picture || store.user?.picture"
              :alt="name"
              class="w-full h-full object-cover rounded-full"
            />
            <span v-else class="font-display font-bold text-2xl text-white">
              {{ name.charAt(0) || 'U' }}
            </span>
          </div>
          <div>
            <h3 class="font-display font-bold text-lg text-white">{{ name || 'Verified User' }}</h3>
            <p class="text-xs text-white/50">{{ phone || store.user?.phone || email || 'No phone set' }}</p>
          </div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck class="w-3.5 h-3.5" /> Tier-1 Verified Entity
          </span>
        </div>

        <!-- Telemetry Metrics -->
        <div class="space-y-4 font-mono text-xs">
          <div class="flex justify-between items-center p-3 bg-[#0A0A0A] rounded-xl border border-white/5">
            <span class="text-white/50 font-sans">CIBIL Telemetry</span>
            <span class="font-bold text-emerald-400 text-sm flex items-center gap-1">
              <TrendingUp class="w-3.5 h-3.5" /> {{ creditScore }}
            </span>
          </div>
          <div class="flex justify-between items-center p-3 bg-[#0A0A0A] rounded-xl border border-white/5">
            <span class="text-white/50 font-sans">Pre-Approved Limit</span>
            <span class="font-bold text-white text-sm">₹{{ preApprovedLimit.toLocaleString('en-IN') }}</span>
          </div>
          <div class="flex justify-between items-center p-3 bg-[#0A0A0A] rounded-xl border border-white/5">
            <span class="text-white/50 font-sans">Verification Status</span>
            <span class="text-emerald-400 font-bold uppercase font-sans">UIDAI & ITD Verified</span>
          </div>
        </div>
      </div>

      <!-- Right Form Editor -->
      <div class="md:col-span-2 bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
        <h3 class="text-lg font-display font-medium text-white pb-4 border-b border-white/10">
          Personal & Financial Telemetry Settings
        </h3>

        <div
          v-if="savedSuccess"
          class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-medium text-xs flex items-center gap-2 animate-fade-in"
        >
          <CheckCircle2 class="w-4 h-4" /> Profile telemetry updated successfully in MongoDB Atlas.
        </div>

        <form @submit.prevent="handleSaveProfile" class="space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-widest text-white/50">Full Name</label>
              <div class="relative">
                <User class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  type="text"
                  v-model="name"
                  class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-widest text-white/50">Email Address</label>
              <div class="relative">
                <Mail class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  type="email"
                  v-model="email"
                  class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-widest text-white/50">Phone Number</label>
              <div class="relative">
                <Phone class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  type="tel"
                  v-model="phone"
                  placeholder="+91 98765 43210"
                  class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-widest text-white/50">Profile Picture URL</label>
              <div class="relative">
                <User class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  type="text"
                  v-model="picture"
                  placeholder="https://lh3.googleusercontent.com/..."
                  class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-widest text-white/50">Monthly Net Income (₹)</label>
              <div class="relative">
                <Briefcase class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  type="number"
                  v-model.number="salary"
                  class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-widest text-white/50">City of Residence</label>
              <div class="relative">
                <MapPin class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  type="text"
                  v-model="city"
                  class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
          </div>

          <!-- Linked Bank Telemetry -->
          <div class="pt-4 border-t border-white/10">
            <h4 class="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">Linked Bank Account Telemetry</h4>
            <div class="grid grid-cols-2 gap-4 bg-[#0A0A0A] p-4 rounded-xl border border-white/5 font-mono text-xs">
              <div>
                <span class="text-white/40 block font-sans text-[10px]">Bank Partner</span>
                <span class="text-white font-bold flex items-center gap-1.5 mt-1">
                  <Building2 class="w-3.5 h-3.5 text-blue-400" /> HDFC Bank Ltd
                </span>
              </div>
              <div>
                <span class="text-white/40 block font-sans text-[10px]">Account Number</span>
                <span class="text-white font-bold flex items-center gap-1.5 mt-1">
                  <CreditCard class="w-3.5 h-3.5 text-emerald-400" /> XXXXXX9821
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            :disabled="isSaving"
            class="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-white/90 shadow-lg shadow-white/10 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <template v-if="isSaving">
              <span class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Saving Profile Telemetry...
            </template>
            <template v-else>
              <Save class="w-4 h-4" /> Save Profile Telemetry
            </template>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Save,
  Building2,
  CreditCard,
} from '@lucide/vue';
import { api } from '@/lib/api';

const store = useLoanStore();

const name = ref(store.user?.name || '');
const email = ref(store.user?.email || '');
const phone = ref(store.user?.phone || '');
const city = ref(store.user?.city || 'Mumbai, Maharashtra');
const salary = ref(store.user?.salary || 75000);
const picture = ref(store.user?.picture || '');
const isSaving = ref(false);
const savedSuccess = ref(false);

const creditScore = computed(() => store.user?.creditScore || 785);
const preApprovedLimit = computed(() => (store.user?.salary ? store.user.salary * 10 : 1500000));

const handleSaveProfile = async () => {
  isSaving.value = true;
  try {
    const targetIdentifier = phone.value || store.user?.phone || email.value || store.user?.email || '';
    if (targetIdentifier) {
      await api.updateProfile({
        phone: targetIdentifier,
        name: name.value,
        email: email.value,
        city: city.value,
        salary: Number(salary.value),
        credit_score: creditScore.value,
        picture: picture.value,
      });
    }

    if (store.user) {
      store.setUser({
        ...store.user,
        name: name.value,
        email: email.value,
        phone: phone.value || store.user.phone || '',
        city: city.value,
        salary: Number(salary.value),
        picture: picture.value,
        creditScore: creditScore.value,
      });
    }

    savedSuccess.value = true;
    setTimeout(() => {
      savedSuccess.value = false;
    }, 3000);
  } catch (err) {
    console.error(err);
  } finally {
    isSaving.value = false;
  }
};
</script>
