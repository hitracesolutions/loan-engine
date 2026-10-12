<template>
  <div class="flex-1 bg-white flex flex-col relative h-full font-sans">
    <!-- Header -->
    <div class="h-16 border-b border-slate-100 flex items-center px-8 bg-white/80 backdrop-blur-md sticky top-0 z-10 justify-between">
      <h1 class="text-[17px] font-bold text-slate-800 flex items-center">
        Loan Assistant
        <span class="text-slate-400 text-sm font-semibold ml-2.5 border-l border-slate-200 pl-2.5">
          Customer Support
        </span>
      </h1>

      <!-- The 'Brain' Visualizer -->
      <div
        v-if="appState.activeAgent"
        class="flex items-center space-x-2 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100 shadow-sm animate-fade-in"
      >
        <div class="animate-spin" style="animation-duration: 4s;">
          <BrainCircuit :size="16" class="text-emerald-600" />
        </div>
        <span class="text-xs font-bold text-emerald-700 font-mono tracking-tight animate-pulse">
          {{ appState.activeAgent }}
        </span>
      </div>
    </div>

    <!-- Chat Feed -->
    <div class="flex-1 overflow-y-auto p-8 space-y-7 flex flex-col pt-10">
      <div
        v-for="msg in chatHistory"
        :key="msg.id"
        class="flex flex-col transition-all duration-200"
        :class="msg.sender === 'user' ? 'items-end' : 'items-start'"
      >
        <!-- Text Message -->
        <div
          v-if="msg.type === 'text'"
          class="p-4 max-w-[75%] text-[15px] leading-relaxed shadow-sm font-medium"
          :class="[
            msg.sender === 'user'
              ? 'bg-slate-900 text-white rounded-[20px] rounded-br-[4px]'
              : 'bg-white text-slate-800 rounded-[20px] rounded-bl-[4px] border border-slate-200/60'
          ]"
        >
          <span v-if="msg.sender === 'user'">{{ msg.content }}</span>
          <div
            v-else
            class="markdown-content prose prose-sm max-w-none text-slate-800 leading-relaxed"
            v-html="renderMarkdown(msg.content)"
          ></div>
        </div>

        <!-- Thinking Indicator -->
        <div v-if="msg.type === 'thinking'">
          <AgentTypingIndicator />
        </div>

        <!-- Interactive Options -->
        <div v-if="msg.options && msg.options.length > 0" class="flex flex-wrap gap-2 mt-3 ml-1">
          <button
            v-for="option in msg.options"
            :key="option"
            @click="onSendMessage(option)"
            class="px-6 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[14px] font-bold hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-sm active:scale-95"
          >
            {{ option }}
          </button>
        </div>

        <!-- Sanction Letter Card -->
        <div
          v-if="msg.type === 'sanction_letter'"
          class="bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-xl shadow-slate-900/5 rounded-2xl rounded-bl-[4px] p-6 max-w-[85%] w-[460px]"
        >
          <div class="flex items-center mb-4 pb-4 border-b border-slate-100">
            <div class="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500 mr-3">
              <FileText :size="20" />
            </div>
            <div>
              <h3 class="font-bold text-[16px] text-slate-800">Sanction Letter</h3>
              <p class="text-xs font-semibold text-slate-400">PDF Document • 1.2 MB</p>
            </div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl mb-5 border border-slate-100/50">
            <div class="text-sm text-slate-600 font-medium mb-1">Approved Amount</div>
            <div class="text-2xl font-black text-emerald-600 mb-2">
              ₹{{ new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(appState.requestedAmount) }}
            </div>
            <p class="text-slate-500 text-[13px] leading-relaxed">
              {{ msg.content }}
            </p>
          </div>
          <div class="flex space-x-3">
            <button
              @click="downloadSanctionLetter"
              class="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
            >
              Download PDF
            </button>
            <button
              :disabled="isSigning"
              @click="handleEsign"
              class="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 shadow-sm shadow-emerald-600/20 text-white text-sm font-bold py-2.5 rounded-xl transition-all flex justify-center items-center active:scale-95"
            >
              <div v-if="isSigning" class="animate-spin mr-1.5">
                <BrainCircuit :size="16" />
              </div>
              <CheckCircle2 v-else :size="16" class="mr-1.5" />
              {{ isSigning ? 'Signing...' : 'Accept & E-Sign' }}
            </button>
          </div>
        </div>

        <!-- Rejection Letter Card -->
        <div
          v-if="msg.type === 'rejection_letter'"
          class="bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-xl shadow-slate-900/5 rounded-2xl rounded-bl-[4px] p-6 max-w-[85%] w-[460px]"
        >
          <div class="flex items-center mb-4 pb-4 border-b border-slate-100">
            <div class="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mr-3">
              <FileText :size="20" />
            </div>
            <div>
              <h3 class="font-bold text-[16px] text-slate-800">Rejection Letter</h3>
              <p class="text-xs font-semibold text-slate-400">PDF Document • System-generated</p>
            </div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl mb-5 border border-slate-100/50">
            <div class="text-sm text-slate-600 font-medium mb-1">Requested Amount</div>
            <div class="text-2xl font-black text-amber-600 mb-2">
              ₹{{ new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(appState.requestedAmount) }}
            </div>
            <p class="text-slate-500 text-[13px] leading-relaxed">
              {{ msg.content }}
            </p>
          </div>
          <div class="flex space-x-3">
            <button
              @click="downloadRejectionLetter"
              class="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
            >
              Download PDF
            </button>
            <button
              @click="onSendMessage('Negotiate')"
              class="flex-1 bg-amber-600 hover:bg-amber-700 shadow-sm text-white text-sm font-bold py-2.5 rounded-xl transition-all flex justify-center items-center active:scale-95"
            >
              Try Negotiation
            </button>
          </div>
        </div>

        <!-- EMI Slider Card -->
        <div
          v-if="msg.type === 'emi_slider'"
          class="bg-white border text-left border-emerald-100 shadow-xl shadow-emerald-900/5 rounded-2xl rounded-bl-[4px] p-5 max-w-[85%] w-[460px]"
        >
          <p class="text-slate-800 text-[15px] font-medium leading-relaxed mb-6">
            {{ msg.content }}
          </p>
          <div class="bg-slate-50 p-5 border border-slate-100 rounded-xl mb-2">
            <div class="flex justify-between items-end mb-4">
              <div>
                <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Tenure</div>
                <div class="text-2xl font-black text-slate-800">
                  {{ appState.tenure }} <span class="text-sm font-semibold text-slate-400">Months</span>
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Monthly EMI</div>
                <div class="text-2xl font-black text-emerald-600">
                  ₹{{ new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(appState.emi) }}
                </div>
              </div>
            </div>

            <input
              type="range"
              min="12"
              max="60"
              step="1"
              :value="appState.tenure"
              @input="handleTenureSlider"
              class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-600 transition-all"
            />
            <div class="flex justify-between text-xs font-semibold text-slate-400 mt-2">
              <span>12m</span>
              <span>60m</span>
            </div>
          </div>
        </div>

        <!-- Collapsible Agent Steps Block -->
        <div
          v-if="msg.type === 'agent_steps' && parseAgentSteps(msg.content).length > 0"
          class="bg-emerald-50/40 border border-emerald-100/60 rounded-xl overflow-hidden shadow-sm mb-3 w-[460px] max-w-[85%] text-left"
        >
          <button
            @click="toggleSteps(msg.id)"
            class="w-full px-4 py-2.5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors border-b border-emerald-100/50"
          >
            <div class="flex items-center text-emerald-800 font-bold text-[13px] tracking-wide">
              <BrainCircuit :size="15" class="mr-2 text-emerald-600" />
              System Actions ({{ parseAgentSteps(msg.content).length }})
            </div>
            <ChevronDown v-if="isStepsOpen(msg.id)" :size="15" class="text-emerald-400" />
            <ChevronRight v-else :size="15" class="text-emerald-400" />
          </button>

          <div v-if="isStepsOpen(msg.id)" class="p-4 space-y-3 bg-white/40">
            <div
              v-for="(step, idx) in parseAgentSteps(msg.content)"
              :key="idx"
              class="flex items-start"
            >
              <CheckCircle2 :size="15" class="text-emerald-500 mt-0.5 mr-2.5 flex-shrink-0" />
              <span class="text-[13px] text-slate-700 font-medium leading-relaxed">{{ cleanStepText(step) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div ref="messagesEndRef" />

      <!-- NBFC Offer Buttons -->
      <div
        v-if="appState.eligible_offers && appState.eligible_offers.length > 0"
        class="mb-4 p-5 bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 rounded-2xl"
      >
        <h3 class="text-sm font-bold text-emerald-900 mb-4 flex items-center">
          <span class="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
          Select Your Preferred NBFC
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            v-for="(offer, idx) in appState.eligible_offers"
            :key="offer.lender_id || idx"
            @click="onSendMessage(`I select ${offer.lender_name} at ${offer.interest_rate}% interest rate.`)"
            class="p-4 bg-white border-2 border-emerald-100 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/30 transition-all shadow-sm text-left active:scale-95"
          >
            <div class="font-bold text-emerald-700 text-sm mb-2">{{ offer.lender_name }}</div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="bg-emerald-50 p-2 rounded-lg">
                <div class="text-emerald-600 font-bold">{{ offer.interest_rate }}%</div>
                <div class="text-slate-500 text-[11px]">Interest</div>
              </div>
              <div class="bg-cyan-50 p-2 rounded-lg">
                <div class="text-cyan-600 font-bold">₹{{ Math.round(offer.emi).toLocaleString() }}</div>
                <div class="text-slate-500 text-[11px]">Monthly</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="p-4 px-8 border-t border-slate-100 bg-white">
      <!-- Document Upload Cards -->
      <div
        v-if="appState.needsDocument && !appState.documents_uploaded"
        class="w-full mb-4"
      >
        <div
          class="grid gap-4"
          :class="appState.requiredDocuments?.length && appState.requiredDocuments.length > 2 ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'"
        >
          <div
            v-for="(docType, idx) in appState.requiredDocuments"
            :key="idx"
            @click="triggerDocUpload(idx)"
            @dragover.prevent
            @drop.prevent="handleDocDrop($event, idx)"
            class="border-dashed border-2 rounded-2xl flex flex-col items-center justify-center p-6 transition-all cursor-pointer group relative overflow-hidden"
            :class="selectedFiles[idx] ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-300 bg-slate-50/50 hover:bg-white hover:border-emerald-400 hover:shadow-md'"
          >
            <div v-if="selectedFiles[idx]" class="absolute top-0 right-0 p-2">
              <div class="bg-emerald-500 text-white p-1 rounded-full shadow-sm">
                <CheckCircle2 :size="12" />
              </div>
            </div>
            <div
              class="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center transition-all mb-3"
              :class="selectedFiles[idx] ? 'text-emerald-500 scale-110' : 'text-slate-400 group-hover:text-emerald-500 group-hover:scale-110'"
            >
              <UploadCloud :size="20" />
            </div>
            <p
              class="text-[13px] font-bold text-center mb-0.5"
              :class="selectedFiles[idx] ? 'text-emerald-700' : 'text-slate-700'"
            >
              {{ selectedFiles[idx] ? selectedFiles[idx].name : docType }}
            </p>
            <p class="text-[11px] font-semibold text-slate-400 text-center uppercase tracking-wider">
              {{ selectedFiles[idx] ? 'Change file' : 'Tap to select' }}
            </p>
          </div>
        </div>

        <!-- Submit Batch Button -->
        <div v-if="Object.keys(selectedFiles).length > 0" class="flex justify-center my-4">
          <button
            @click="handleSubmitBatch"
            :disabled="Object.keys(selectedFiles).length < (appState.requiredDocuments?.length || 0)"
            class="px-8 py-3 rounded-2xl font-black text-[14px] shadow-lg transition-all active:scale-95 flex items-center"
            :class="[
              Object.keys(selectedFiles).length >= (appState.requiredDocuments?.length || 0)
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            ]"
          >
            Submit {{ Object.keys(selectedFiles).length }} Document(s) for Verification
            <CheckCircle2 :size="18" class="ml-2.5" />
          </button>
        </div>
      </div>

      <!-- Chat Input Form -->
      <form
        @submit.prevent="handleSubmit"
        class="flex flex-col relative w-full rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/50 transition-all overflow-hidden group"
      >
        <textarea
          v-model="input"
          @keydown="handleKeyDown"
          placeholder="Talk or type to the Agent..."
          class="w-full bg-transparent p-4 pb-12 outline-none resize-none min-h-[80px] text-[15px] font-medium placeholder:text-slate-400"
        ></textarea>
        <div class="absolute bottom-3 right-3 left-3 flex justify-between items-center">
          <input
            type="file"
            ref="fileInputRef"
            @change="handleFileChange"
            class="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
          />
          <button
            type="button"
            @click="fileInputRef?.click()"
            class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors"
          >
            <Paperclip :size="20" />
          </button>
          <button
            type="submit"
            :disabled="!input.trim()"
            class="px-5 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center shadow-md shadow-slate-900/20 active:scale-95"
          >
            Send <Send :size="16" class="ml-2" />
          </button>
        </div>
      </form>
      <div class="text-center mt-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center space-x-1.5">
        <span>Secure NBFC Assistant</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick } from 'vue';
import type { ChatMessage, AppState } from '../types';
import { apiClient } from '../api/client';
import {
  Send,
  Paperclip,
  FileText,
  CheckCircle2,
  UploadCloud,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
} from '@lucide/vue';
import AgentTypingIndicator from './AgentTypingIndicator.vue';
import { marked } from 'marked';

const props = defineProps<{
  appState: AppState;
  chatHistory: ChatMessage[];
  onSendMessage: (msg: string) => void;
  onFileUpload: (file: File) => void;
  onBatchFileUpload: (files: File[]) => void;
}>();

const emit = defineEmits<{
  (e: 'update:appState', state: AppState): void;
}>();

const input = ref('');
const selectedFiles = reactive<Record<number, File>>({});
const isSigning = ref(false);
const messagesEndRef = ref<HTMLDivElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const openStepsMap = reactive<Record<string, boolean>>({});

const renderMarkdown = (text: string) => {
  return marked.parse(text || '');
};

const parseAgentSteps = (content: string): string[] => {
  try {
    const data = JSON.parse(content);
    return data.steps || [];
  } catch {
    return [];
  }
};

const cleanStepText = (step: string) => {
  return step.replace(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]\s*/gu, '').trim();
};

const isStepsOpen = (id: string) => {
  return openStepsMap[id] !== false; // defaults to true
};

const toggleSteps = (id: string) => {
  openStepsMap[id] = !isStepsOpen(id);
};

const scrollToBottom = () => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  });
};

watch(() => props.chatHistory.length, () => {
  scrollToBottom();
});

const handleSubmit = () => {
  if (!input.value.trim()) return;
  props.onSendMessage(input.value.trim());
  input.value = '';
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit();
  }
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    props.onFileUpload(file);
    target.value = '';
  }
};

const triggerDocUpload = (idx: number) => {
  const inputEl = document.createElement('input');
  inputEl.type = 'file';
  inputEl.accept = 'application/pdf,image/jpeg,image/png';
  inputEl.onchange = (e: any) => {
    const file = e.target?.files?.[0];
    if (file) {
      selectedFiles[idx] = file;
    }
  };
  inputEl.click();
};

const handleDocDrop = (e: DragEvent, idx: number) => {
  if (e.dataTransfer?.files?.[0]) {
    selectedFiles[idx] = e.dataTransfer.files[0];
  }
};

const handleSubmitBatch = () => {
  const files = Object.values(selectedFiles);
  props.onBatchFileUpload(files);
  for (const k in selectedFiles) {
    delete selectedFiles[k];
  }
};

const handleTenureSlider = (e: Event) => {
  const t = parseInt((e.target as HTMLInputElement).value);
  const r = (props.appState.roi || 0) / 12 / 100;
  const p = props.appState.requestedAmount || 0;
  const calcEmi = r === 0 ? Math.round(p / t) : Math.round(p * r * Math.pow(1 + r, t) / (Math.pow(1 + r, t) - 1));
  emit('update:appState', {
    ...props.appState,
    tenure: t,
    emi: calcEmi,
  });
};

const downloadSanctionLetter = async () => {
  if (!props.appState.sessionId) return;
  try {
    const blob = await apiClient.downloadLetter(props.appState.sessionId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sanction_Letter_${props.appState.sessionId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download failed:', err);
  }
};

const handleEsign = async () => {
  if (!props.appState.sessionId) return;
  isSigning.value = true;
  try {
    await apiClient.esignAccept(props.appState.sessionId);
    props.onSendMessage('I accept the sanction letter and e-sign it.');
  } catch (err) {
    console.error('E-sign failed:', err);
  } finally {
    isSigning.value = false;
  }
};

const downloadRejectionLetter = async () => {
  if (!props.appState.sessionId) return;
  try {
    const blob = await apiClient.downloadLetter(props.appState.sessionId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rejection_Letter_${props.appState.sessionId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download failed:', err);
  }
};
</script>
