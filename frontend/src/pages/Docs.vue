<template>
  <div class="max-w-5xl mx-auto space-y-16 py-8">
    <!-- Hero -->
    <div class="text-center space-y-4">
      <h1 class="text-4xl font-bold text-white tracking-tight">FinServe Platform</h1>
      <p class="text-lg text-white/60 max-w-2xl mx-auto">
        An autonomous lending infrastructure powered by state-graph orchestration,
        real-time credit profiling, and cryptographic-grade risk underwriting.
      </p>
      <div class="flex items-center justify-center gap-4 text-sm text-white/40 pt-2">
        <span class="flex items-center gap-1.5"><Globe class="w-4 h-4" /> Production</span>
        <span class="flex items-center gap-1.5"><Cpu class="w-4 h-4" /> v1.0.0</span>
      </div>
    </div>

    <!-- Quick Links -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        v-for="(item, i) in quickLinks"
        :key="i"
        class="border border-white/10 bg-white/[0.02] rounded-lg p-4 text-center hover:bg-white/5 transition-colors cursor-pointer"
      >
        <component :is="item.icon" class="w-6 h-6 text-emerald-400 mb-2 mx-auto" />
        <p class="text-xs font-medium text-white/70">{{ item.label }}</p>
        <p class="text-xs text-white/40">{{ item.desc }}</p>
      </div>
    </div>

    <!-- Workflow -->
    <section class="space-y-6">
      <h2 class="text-2xl font-semibold text-white tracking-tight">Borrower Workflow</h2>
      <div class="border border-white/10 bg-[#0d0d0d] rounded-lg p-6">
        <ol class="space-y-6 ml-0">
          <li v-for="s in workflowSteps" :key="s.step" class="flex items-start gap-4">
            <div class="mt-1 w-10 h-10 flex-shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center">
              <span class="text-xs font-mono text-emerald-300">{{ s.step }}</span>
            </div>
            <div>
              <p class="font-medium text-white">{{ s.title }}</p>
              <p class="text-sm text-white/50 mt-0.5">{{ s.description }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- API Table -->
    <section class="space-y-6">
      <h2 class="text-2xl font-semibold text-white">Core API Routes</h2>
      <div class="border border-white/10 rounded-lg overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead class="bg-white/5">
            <tr>
              <th class="py-3 px-4 font-medium text-white/80">Endpoint</th>
              <th class="py-3 px-4 font-medium text-white/80">Method</th>
              <th class="py-3 px-4 font-medium text-white/80">Description</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr v-for="route in apiRoutes" :key="route[0]" class="hover:bg-white/5 transition-colors">
              <td class="py-3 px-4 font-mono text-emerald-300 text-xs">{{ route[0] }}</td>
              <td class="py-3 px-4 text-xs">
                <span class="bg-white/10 text-white/70 px-2 py-0.5 rounded text-xs font-mono">{{ route[1] }}</span>
              </td>
              <td class="py-3 px-4 text-white/50">{{ route[2] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Security & Compliance -->
    <section class="space-y-6">
      <h2 class="text-2xl font-semibold text-white">Security & Compliance</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="(item, i) in securityItems" :key="i" class="border border-white/10 rounded-lg p-4 bg-[#0d0d0d]">
          <component :is="item.icon" class="w-6 h-6 text-blue-400 mb-2" />
          <p class="font-medium text-white text-sm">{{ item.title }}</p>
          <p class="text-xs text-white/50 mt-1">{{ item.description }}</p>
        </div>
      </div>
    </section>

    <!-- FAQ — compact -->
    <section class="space-y-6">
      <h2 class="text-2xl font-semibold text-white">FAQ</h2>
      <div v-for="(item, i) in faqs" :key="i" class="border-b border-white/10 pb-4 last:border-0">
        <p class="text-white font-medium text-sm">{{ item.q }}</p>
        <p class="text-white/50 text-sm mt-1">{{ item.a }}</p>
      </div>
    </section>

    <!-- Bottom CTA -->
    <div class="text-center pb-12">
      <a href="/" class="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors">
        <Globe class="w-4 h-4" />
        Back to FinServe AI
        <ArrowRight class="w-4 h-4" />
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Zap, FileText, BarChart3, Shield, Cpu, ArrowRight, Globe, Lock } from '@lucide/vue';

const quickLinks = [
  { icon: Zap, label: 'Quick Start', desc: 'Get loan in 4 steps' },
  { icon: FileText, label: 'API Endpoints', desc: 'REST interface' },
  { icon: BarChart3, label: 'Analytics', desc: 'Dashboard overview' },
  { icon: Shield, label: 'Security', desc: 'Encryption & auth' },
];

const workflowSteps = [
  { step: 1, title: 'Create Account', description: 'Register using phone OTP or Google SSO to secure your identity.' },
  { step: 2, title: 'Complete Profile', description: 'Provide income, employment, PAN, Aadhar, and upload documents.' },
  { step: 3, title: 'AI Underwriting', description: 'Dual‑LLM decisioning engine evaluates credit worthiness in under 400ms.' },
  { step: 4, title: 'Accept & Disburse', description: 'Review offer, e‑sign the sanction letter, and receive funds.' },
];

const apiRoutes = [
  ['/api/auth/signup', 'POST', 'Create new borrower account'],
  ['/api/auth/login', 'POST', 'Authenticate existing user'],
  ['/api/auth/google', 'GET', 'Initiate OAuth flow'],
  ['/api/underwriting/evaluate', 'POST', 'AI risk scoring'],
  ['/api/sanction/generate', 'POST', 'Issue loan agreement'],
  ['/api/loan/repay', 'POST', 'Process EMI payment'],
  ['/api/admin/dashboard', 'GET', 'Administrator overview'],
];

const securityItems = [
  { icon: Lock, title: 'End‑to‑end Encryption', description: 'All data in transit is protected by TLS 1.3 and at rest by AES‑256.' },
  { icon: Shield, title: 'GDPR / PDP Bill', description: 'We comply with Indian DPDP Act 2023 and global data privacy rules.' },
  { icon: BarChart3, title: 'Audit Logs', description: 'Every underwriting decision is recorded immutably for regulatory reporting.' },
];

const faqs = [
  { q: 'How are interest rates determined?', a: 'Our dual‑LLM engine computes prime‑adjusted rates using 18 financial variables, including CIBIL, DTI, and employer‑class.' },
  { q: 'Can I prepay my loan?', a: 'Yes. Pre‑closure is permitted any time subject to a 24‑hour cooling period. Visit Active Loans → Prepay.' },
  { q: 'What is the maximum loan amount?', a: 'Self‑employed: ₹50L. Salaried: up to ₹1Cr, based on exposure‑multiplier and bureau score.' },
];
</script>
