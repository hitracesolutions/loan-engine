<template>
  <div class="bg-slate-50 border border-slate-200/60 shadow-sm text-slate-500 rounded-[20px] rounded-bl-[4px] p-4 max-w-[75%] flex flex-col space-y-2 relative overflow-hidden">
    <div class="flex space-x-1.5 items-center mr-1">
      <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 0s" />
      <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 0.2s" />
      <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 0.4s" />
    </div>

    <div class="h-5 relative w-full flex items-center min-w-[300px]">
      <Transition name="fade-slide" mode="out-in">
        <span
          :key="phaseIndex"
          class="text-sm font-semibold text-slate-600 absolute left-0 whitespace-nowrap"
        >
          {{ AGENT_PHASES[phaseIndex] }}
        </span>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const AGENT_PHASES = [
  '🤖 Master Agent analyzing...',
  '📊 Underwriting Agent calculating risk...',
  '🤝 Sales Agent drafting response...',
];

const phaseIndex = ref(0);
let interval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  interval = setInterval(() => {
    phaseIndex.value = (phaseIndex.value + 1) % AGENT_PHASES.length;
  }, 1500);
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
});
</script>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
