<template>
  <div class="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-white/20">
    <!-- Background Ambience -->
    <div class="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px]" />
      <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/5 blur-[120px]" />
    </div>

    <div class="relative z-10 flex flex-col min-h-screen">
      <!-- Vercel-style Top Navigation -->
      <header class="sticky top-0 h-16 border-b border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl flex items-center px-6 lg:px-10 z-40">
        <div class="flex items-center gap-8 w-full max-w-7xl mx-auto">
          <!-- Logo -->
          <div class="flex items-center gap-3 shrink-0 cursor-pointer" @click="store.setView('DASHBOARD')">
            <div class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <ShieldCheck class="w-4 h-4 text-white" />
            </div>
            <span class="font-display font-medium tracking-tight">FinServe<span class="text-white/40">.AI</span></span>
          </div>

          <!-- Nav Links -->
          <nav class="hidden md:flex items-center gap-1">
            <button
              v-for="item in navigation"
              :key="item.id"
              @click="store.setView(item.id as any)"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                store.currentView === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              ]"
            >
              <component
                :is="item.icon"
                :class="['w-4 h-4', store.currentView === item.id ? 'text-emerald-500' : 'opacity-70']"
              />
              {{ item.name }}
            </button>
          </nav>

          <!-- Profile Menu -->
          <div class="ml-auto flex items-center gap-4">
            <div
              @click="store.setView('PROFILE')"
              class="flex items-center gap-3 cursor-pointer p-1.5 rounded-xl hover:bg-white/5 transition-all group"
              title="Click to view & edit borrower profile"
            >
              <div class="text-right hidden sm:block">
                <p class="text-sm font-medium text-white leading-none group-hover:text-emerald-400 transition-colors">
                  {{ store.user?.name || 'Partner' }}
                </p>
                <p class="text-[10px] text-white/40 uppercase tracking-widest mt-1 font-mono">View Profile →</p>
              </div>
              <div class="w-9 h-9 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center group-hover:border-emerald-500/50 transition-colors">
                <img
                  v-if="store.user?.picture"
                  :src="store.user.picture"
                  alt="Profile"
                  class="w-full h-full object-cover"
                />
                <span v-else class="font-display font-bold text-sm">
                  {{ store.user?.name?.charAt(0) || 'U' }}
                </span>
              </div>
            </div>
            <button
              @click="store.clearSession"
              title="Sign Out"
              class="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all ml-1"
            >
              <LogOut class="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <!-- Main Content Area -->
      <main class="flex-1 w-full max-w-7xl mx-auto px-6 lg:px-10 py-8 relative">
        <div class="animate-fade-in slide-in-from-bottom-2">
          <AnalyticsDashboard v-if="store.currentView === 'DASHBOARD'" />
          <GenUiApplication v-else-if="store.currentView === 'APPLICATION'" />
          <ActiveLoans v-else-if="store.currentView === 'ACTIVE_LOANS'" />
          <UserProfile v-else-if="store.currentView === 'PROFILE'" />
          <Docs v-else-if="store.currentView === 'DOCS'" />
          <AnalyticsDashboard v-else />
        </div>
      </main>
    </div>

    <!-- Global Agent Overlay -->
    <AgentOverlay :logs="store.agentLogs" :is-active="store.isAgentActive" />
  </div>
</template>

<script setup lang="ts">
import { useLoanStore } from '@/stores/loanStore';
import { ShieldCheck, LayoutDashboard, CreditCard, Bot, LogOut } from '@lucide/vue';
import AgentOverlay from '@/components/shared/AgentOverlay.vue';
import AnalyticsDashboard from '@/components/workspace/pages/AnalyticsDashboard.vue';
import GenUiApplication from '@/components/workspace/pages/GenUiApplication.vue';
import ActiveLoans from '@/components/workspace/pages/ActiveLoans.vue';
import UserProfile from '@/components/workspace/pages/UserProfile.vue';
import Docs from '@/pages/Docs.vue';

const store = useLoanStore();

const navigation = [
  { name: 'Dashboard', id: 'DASHBOARD', icon: LayoutDashboard },
  { name: 'System Intelligence', id: 'APPLICATION', icon: Bot },
  { name: 'Active Loans & Ledgers', id: 'ACTIVE_LOANS', icon: CreditCard },
];
</script>
