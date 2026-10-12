<template>
  <div v-if="isActive" class="fixed bottom-6 right-6 w-96 bg-[#0A0A0A]/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-5">
    <div class="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
      <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
        <Bot class="w-4 h-4 text-emerald-500" />
      </div>
      <div>
        <h4 class="text-sm font-semibold text-white tracking-tight">{{ agentName }}</h4>
        <p class="text-[10px] text-emerald-500/80 uppercase tracking-widest font-bold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Executing Workflow
        </p>
      </div>
    </div>
    
    <div class="p-4 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto">
      <div v-for="(log, idx) in displayedLogs" :key="idx" class="flex gap-2 text-white/70 animate-fade-in mb-2">
        <ChevronRight class="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
        <span class="break-words">{{ log }}</span>
      </div>
      
      <!-- Blinking Cursor -->
      <div v-if="isActive && displayedLogs.length === logs.length" class="flex gap-2 text-white/40 mt-2">
        <Terminal class="w-3 h-3 text-white/30 shrink-0 mt-0.5" />
        <span class="animate-pulse">Processing context via LangGraph...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Bot, Terminal, ChevronRight } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    logs: string[];
    isActive: boolean;
    agentName?: string;
  }>(),
  {
    agentName: 'System Intelligence',
  }
);

const displayedLogs = ref<string[]>([]);
let timer: ReturnType<typeof setTimeout> | null = null;

const stepLogs = () => {
  if (timer) clearTimeout(timer);
  if (props.isActive) {
    if (props.logs.length > displayedLogs.value.length) {
      timer = setTimeout(() => {
        displayedLogs.value = props.logs.slice(0, displayedLogs.value.length + 1);
        stepLogs();
      }, 300);
    }
  } else {
    if (displayedLogs.value.length > 0) {
      timer = setTimeout(() => {
        displayedLogs.value = [];
      }, 500);
    }
  }
};

watch(
  () => [props.isActive, props.logs.length],
  () => {
    stepLogs();
  },
  { immediate: true }
);
</script>
