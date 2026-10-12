<template>
  <div class="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-xl relative overflow-hidden group">
    <div class="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors" />

    <h3 class="text-xl font-display font-medium text-white mb-6 tracking-tight relative z-10">
      Identity & Income Verification
    </h3>

    <form @submit.prevent="handleSubmit" class="space-y-4 relative z-10">
      <div class="space-y-1.5">
        <label class="text-xs font-semibold uppercase tracking-widest text-white/50">Phone Number</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Phone class="w-4 h-4 text-white/30" />
          </div>
          <input
            required
            type="tel"
            v-model="phone"
            class="w-full bg-[#0A0A0A] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
            placeholder="+91 99999 99999"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-semibold uppercase tracking-widest text-white/50">Monthly Net Income</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Briefcase class="w-4 h-4 text-white/30" />
          </div>
          <input
            required
            type="number"
            v-model="salary"
            class="w-full bg-[#0A0A0A] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
            placeholder="₹ 1,50,000"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-semibold uppercase tracking-widest text-white/50">City of Residence</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MapPin class="w-4 h-4 text-white/30" />
          </div>
          <input
            required
            type="text"
            v-model="city"
            class="w-full bg-[#0A0A0A] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
            placeholder="Bengaluru, Karnataka"
          />
        </div>
      </div>

      <button
        type="submit"
        :disabled="isSubmitting || !phone || !salary || !city"
        class="w-full mt-6 h-12 bg-white text-black rounded-lg font-medium shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <span v-if="isSubmitting" class="flex items-center gap-2">
          <span class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          Initializing Profile...
        </span>
        <span v-else class="flex items-center gap-2">
          Sync Credit Profile
          <ArrowRight class="w-4 h-4" />
        </span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useLoanStore } from '@/stores/loanStore';
import { ArrowRight, MapPin, Phone, Briefcase } from '@lucide/vue';

const store = useLoanStore();
const phone = ref('');
const salary = ref('');
const city = ref('');
const isSubmitting = ref(false);

const handleSubmit = () => {
  isSubmitting.value = true;
  setTimeout(() => {
    if (store.user) {
      store.setUser({
        ...store.user,
        phone: phone.value,
        salary: Number(salary.value),
        city: city.value,
        creditScore: 785,
      });
    }
    isSubmitting.value = false;
    store.setState('ONBOARDING');
  }, 1500);
};
</script>
