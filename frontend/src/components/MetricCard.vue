<template>
  <div
    :class="[
      'bg-white p-3 rounded-lg border shadow-sm flex flex-col justify-center items-start overflow-hidden transition-all duration-300',
      isAnimating ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-slate-100'
    ]"
  >
    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-0">{{ label }}</span>
    <div class="text-sm font-black text-slate-800 flex items-baseline relative">
      <span v-if="prefix" class="text-xs mr-0.5 text-slate-500">{{ prefix }}</span>
      <span>{{ formattedValue }}</span>
      <span v-if="suffix" class="text-[10px] ml-0.5 text-slate-500 font-bold">{{ suffix }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
  }>(),
  {
    prefix: '',
    suffix: '',
    decimals: 0,
  }
);

const isAnimating = ref(false);

watch(
  () => props.value,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      isAnimating.value = true;
      setTimeout(() => {
        isAnimating.value = false;
      }, 800);
    }
  }
);

const formattedValue = computed(() => {
  return props.value.toLocaleString('en-IN', {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals,
  });
});
</script>
