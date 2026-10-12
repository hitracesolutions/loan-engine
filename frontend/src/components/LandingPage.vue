<template>
  <div class="min-h-screen bg-[#0A0A0A] text-white selection:bg-white/20 overflow-x-hidden font-sans">
    <!-- Absolute Background Effects -->
    <div class="fixed inset-0 z-0 pointer-events-none">
      <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
      <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[120px]" />
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
    </div>

    <!-- Ultra Minimal Navbar -->
    <nav class="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#0A0A0A]/80 backdrop-blur-xl">
      <div class="container mx-auto px-6 h-20 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ShieldCheck class="w-5 h-5 text-white" />
          </div>
          <span class="font-display font-medium text-xl tracking-tight">FinServe<span class="text-white/40">.AI</span></span>
        </div>
        <div class="hidden md:flex items-center gap-8">
          <a href="#platform" class="text-sm text-white/60 hover:text-white transition-colors tracking-wide">Platform</a>
          <a href="#security" class="text-sm text-white/60 hover:text-white transition-colors tracking-wide">Security</a>
          <a href="#leadership" class="text-sm text-white/60 hover:text-white transition-colors tracking-wide">Company</a>
        </div>
        <div class="flex items-center gap-4">
          <button
            @click="handleOpenAuth"
            class="text-white/70 hover:text-white hover:bg-white/5 h-11 px-6 rounded-lg text-sm font-medium transition-all"
          >
            Sign In
          </button>
          <button
            @click="handleOpenAuth"
            class="hidden sm:inline-flex items-center justify-center bg-white text-black shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] h-11 px-6 rounded-lg text-sm font-medium transition-all"
          >
            Get Started <ArrowRight class="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </nav>

    <main class="relative z-10 pt-20">
      <!-- Hero Section -->
      <section class="relative pt-32 pb-24 md:pt-48 md:pb-32 px-6">
        <div class="container mx-auto max-w-5xl text-center">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in opacity-0" style="animation-delay: 0.1s; animation-fill-mode: forwards;">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span class="text-xs font-medium tracking-widest text-white/70 uppercase">System v2.0 Live</span>
          </div>
          
          <h1 class="font-display text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-8 leading-[1.1] animate-slide-up opacity-0" style="animation-delay: 0.2s; animation-fill-mode: forwards;">
            Deterministic lending.<br />
            <span class="text-white/40">Zero human latency.</span>
          </h1>
          
          <p class="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 font-light tracking-wide leading-relaxed animate-slide-up opacity-0" style="animation-delay: 0.3s; animation-fill-mode: forwards;">
            FinServe orchestrates capital deployment through autonomous StateGraph engines, evaluating risk with cryptographic precision in sub-450ms.
          </p>
          
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up opacity-0" style="animation-delay: 0.4s; animation-fill-mode: forwards;">
            <button
              @click="handleOpenAuth"
              class="w-full sm:w-auto min-w-[200px] h-14 px-8 text-base bg-white text-black rounded-lg font-medium shadow-lg hover:scale-[1.02] transition-all"
            >
              Initialize Protocol
            </button>
            <a
              href="/docs"
              class="w-full sm:w-auto min-w-[200px] h-14 px-8 text-base border border-white/10 bg-transparent text-white hover:bg-white/5 rounded-lg font-medium transition-all inline-flex items-center justify-center gap-2"
            >
              <BookOpen class="w-4 h-4 mr-2" />
              View Documentation
            </a>
          </div>
        </div>
      </section>

      <!-- Bento Grid Features -->
      <section id="platform" class="py-24 px-6 border-t border-white/[0.05]">
        <div class="container mx-auto max-w-6xl">
          <div class="mb-16">
            <h2 class="font-display text-3xl md:text-4xl font-medium tracking-tight mb-4">Institutional Infrastructure</h2>
            <p class="text-white/50 text-lg max-w-xl font-light">Built from the ground up to replace legacy underwriting completely.</p>
          </div>

          <div class="grid md:grid-cols-3 gap-6">
            <div class="md:col-span-2 group p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors relative overflow-hidden">
              <div class="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors" />
              <Cpu class="w-8 h-8 text-white/70 mb-6" />
              <h3 class="font-display text-2xl font-medium mb-3">StateGraph Underwriting Engine</h3>
              <p class="text-white/50 leading-relaxed max-w-md font-light">
                Our proprietary engine constructs a multidimensional risk graph by ingesting over 40,000 alternative data points, bypassing traditional CIBIL limitations to evaluate true creditworthiness.
              </p>
            </div>

            <div class="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
              <Zap class="w-8 h-8 text-white/70 mb-6" />
              <h3 class="font-display text-xl font-medium mb-3">Sub-450ms Decisions</h3>
              <p class="text-white/50 leading-relaxed font-light">
                Capital is committed almost instantly. We've eliminated human bottlenecks entirely from the origination pipeline.
              </p>
            </div>

            <div class="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
              <Fingerprint class="w-8 h-8 text-white/70 mb-6" />
              <h3 class="font-display text-xl font-medium mb-3">Vision AI KYC</h3>
              <p class="text-white/50 leading-relaxed font-light">
                Automated parsing of identity documents using advanced optical character recognition with 99.9% verifiable accuracy.
              </p>
            </div>

            <div class="md:col-span-2 group p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors flex flex-col justify-end relative overflow-hidden">
              <div class="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
              <Globe2 class="w-8 h-8 text-white/70 mb-6" />
              <h3 class="font-display text-2xl font-medium mb-3">SHAP Explainability Protocol</h3>
              <p class="text-white/50 leading-relaxed max-w-md font-light">
                Every decision is completely transparent. Our platform provides Shapley Additive Explanations (SHAP) for every rejection, enabling full regulatory compliance and borrower trust.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Metrics Banner -->
      <section class="py-24 border-y border-white/[0.05] bg-white/[0.01]">
        <div class="container mx-auto max-w-6xl px-6">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12">
            <div>
              <p class="text-4xl md:text-5xl font-display font-medium mb-2 tracking-tight">₹250<span class="text-white/40">Cr</span></p>
              <p class="text-sm text-white/50 uppercase tracking-widest font-semibold">Volume Processed</p>
            </div>
            <div>
              <p class="text-4xl md:text-5xl font-display font-medium mb-2 tracking-tight">450<span class="text-white/40">ms</span></p>
              <p class="text-sm text-white/50 uppercase tracking-widest font-semibold">Decision Latency</p>
            </div>
            <div>
              <p class="text-4xl md:text-5xl font-display font-medium mb-2 tracking-tight">0<span class="text-white/40">%</span></p>
              <p class="text-sm text-white/50 uppercase tracking-widest font-semibold">Human Intervention</p>
            </div>
            <div>
              <p class="text-4xl md:text-5xl font-display font-medium mb-2 tracking-tight">12<span class="text-white/40">M+</span></p>
              <p class="text-sm text-white/50 uppercase tracking-widest font-semibold">Data Points Analyzed</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Leadership Section -->
      <section id="leadership" class="py-24 px-6 border-b border-white/[0.05]">
        <div class="container mx-auto max-w-6xl">
          <div class="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
            <div>
              <h2 class="font-display text-3xl md:text-4xl font-medium tracking-tight mb-4">Core Architecture Team</h2>
              <p class="text-white/50 text-lg max-w-xl font-light">The engineers and quants building the future of autonomous finance.</p>
            </div>
          </div>

          <div class="grid md:grid-cols-3 gap-8">
            <div
              v-for="(founder, i) in founders"
              :key="i"
              class="group border-t border-white/10 pt-6"
            >
              <h3 class="font-display text-xl font-medium mb-1">{{ founder.name }}</h3>
              <p class="text-sm text-white/50 font-medium tracking-wide">{{ founder.role }}</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="py-12 border-t border-white/[0.05] relative z-10 text-center text-white/40 text-sm">
      <div class="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <p>© {{ new Date().getFullYear() }} FinServe Technologies Inc.</p>
        <div class="flex gap-6">
          <a href="#" class="hover:text-white transition-colors">Privacy</a>
          <a href="#" class="hover:text-white transition-colors">Terms</a>
          <a href="#" class="hover:text-white transition-colors">System Status</a>
        </div>
      </div>
    </footer>

    <!-- Auth Modal -->
    <AuthModal :is-open="isAuthOpen" @close="isAuthOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ShieldCheck, ArrowRight, Cpu, Zap, Fingerprint, Globe2, BookOpen } from '@lucide/vue';
import AuthModal from './auth/AuthModal.vue';
import { useLoanStore } from '@/stores/loanStore';

const isAuthOpen = ref(false);
const store = useLoanStore();

const handleOpenAuth = () => {
  isAuthOpen.value = true;
};

const founders = [
  { name: 'Sarang Rao', role: 'Co-Founder & Systems Architect' },
  { name: 'Sanvi Nyati', role: 'Co-Founder & AI Engineering Lead' },
  { name: 'Sumit Arya', role: 'Co-Founder & Product Lead' },
];
</script>
