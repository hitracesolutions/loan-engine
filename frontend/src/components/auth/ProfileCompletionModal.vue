<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
    <div class="bg-[#111] border border-white/10 rounded-2xl max-w-md w-full p-8 shadow-2xl relative text-white">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
          <ShieldCheck class="w-5 h-5" />
        </div>
        <div>
          <h3 class="font-display font-medium text-lg text-white">Complete Google OAuth Profile</h3>
          <p class="text-xs text-white/40">Verify identity parameters to enable underwriting</p>
        </div>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Phone Number</label>
          <div class="relative">
            <Phone class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
            <input
              required
              type="tel"
              v-model="phone"
              placeholder="+91 99999 99999"
              class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
            />
          </div>
        </div>

        <div>
          <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Monthly Net Income</label>
          <div class="relative">
            <Briefcase class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
            <input
              required
              type="number"
              v-model="salary"
              placeholder="₹ 1,50,000"
              class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
            />
          </div>
        </div>

        <div>
          <label class="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">City of Residence</label>
          <div class="relative">
            <MapPin class="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
            <input
              required
              type="text"
              v-model="city"
              placeholder="Bengaluru"
              class="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
            />
          </div>
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full h-12 mt-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {{ loading ? 'Updating MongoDB...' : 'Save Profile & Enter Workspace' }}
          <ArrowRight class="w-4 h-4" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '@/lib/api';
import { useLoanStore } from '@/stores/loanStore';
import { ShieldCheck, Phone, Briefcase, MapPin, ArrowRight } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    phoneInitial?: string;
  }>(),
  {
    phoneInitial: '',
  }
);

const emit = defineEmits<{
  (e: 'completed'): void;
}>();

const store = useLoanStore();

const phone = ref(props.phoneInitial || store.user?.phone || '');
const salary = ref(store.user?.salary ? String(store.user.salary) : '');
const city = ref(store.user?.city || '');
const loading = ref(false);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      phone.value = props.phoneInitial || store.user?.phone || '';
      salary.value = store.user?.salary ? String(store.user.salary) : '';
      city.value = store.user?.city || '';
    }
  }
);

const handleSubmit = async () => {
  loading.value = true;

  const targetIdentifier = phone.value || store.user?.phone || store.user?.email || '';
  if (targetIdentifier) {
    await api.updateProfile({
      phone: targetIdentifier,
      name: store.user?.name,
      email: store.user?.email,
      picture: store.user?.picture,
      salary: Number(salary.value) || 75000,
      city: city.value || 'Mumbai',
    });
  }

  loading.value = false;

  if (store.user) {
    store.setUser({
      ...store.user,
      phone: phone.value || store.user.phone || '',
      salary: Number(salary.value) || store.user.salary || 75000,
      city: city.value || store.user.city || 'Mumbai',
    });
  }

  emit('completed');
};
</script>
