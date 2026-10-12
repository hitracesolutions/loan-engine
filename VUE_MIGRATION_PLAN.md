# 🚀 LoanNBFC — React → Vue.js Migration Plan

> **Status Legend:** ⬜ Not Started · 🔄 In Progress · ✅ Done · ❌ Blocked

---

## 📋 Project Overview

**Current Stack:**
- Framework: React 19 + TypeScript
- Build tool: Vite
- State: Zustand (with persist middleware)
- Styling: Tailwind CSS v3 + shadcn/ui
- Animation: Framer Motion
- Charts: Recharts
- HTTP: Native fetch (apiClient wrapper)
- WebSocket: Native WebSocket
- Icons: lucide-react

**Target Stack:**
- Framework: **Vue 3** + TypeScript (Composition API)
- Build tool: Vite (same)
- State: **Pinia** (Vue's official store, replaces Zustand)
- Styling: Tailwind CSS v3 (same config)
- Animation: **@vueuse/motion** (replaces Framer Motion)
- Charts: **vue-chartjs** or **Chart.js** (replaces Recharts)
- HTTP: Same native fetch wrapper (reusable as-is)
- WebSocket: Same native WebSocket (reusable as-is)
- Icons: **lucide-vue-next** (replaces lucide-react)

---

## 📁 Files to Migrate

### Root / Entry
| File | Description | Status |
|------|-------------|--------|
| `frontend/src/main.tsx` → `main.ts` | App entry, createApp, plugins mount | ⬜ |
| `frontend/src/App.tsx` → `App.vue` | Root component, routing/auth logic | ⬜ |
| `frontend/index.html` | Update script src to `main.ts` | ⬜ |
| `frontend/vite.config.ts` | Add `@vitejs/plugin-vue` | ⬜ |
| `frontend/tsconfig.app.json` | Add Vue type support | ⬜ |
| `frontend/package.json` | Swap React deps for Vue deps | ⬜ |

### State Management (`src/store/`)
| File | Description | Status |
|------|-------------|--------|
| `useLoanStore.ts` → `loanStore.ts` | Zustand store → Pinia store (persist plugin) | ⬜ |

### Types (`src/types/` & `src/types.ts`)
| File | Description | Status |
|------|-------------|--------|
| `src/types.ts` | Pure TS interfaces — **reuse as-is** | ✅ |
| `src/store/useLoanStore.ts` (types) | Move `AppState`, `UserProfile`, etc. to `src/types/` | ⬜ |

### API Layer (`src/api/`)
| File | Description | Status |
|------|-------------|--------|
| `src/api/client.ts` | Pure TS — **reuse as-is** | ✅ |
| `src/api/websocket.ts` | Pure TS — **reuse as-is** | ✅ |

### Hooks → Composables (`src/hooks/` → `src/composables/`)
| React Hook | Vue Composable | Status |
|-----------|---------------|--------|
| `useAdminAPI.ts` | `useAdminAPI.ts` (rewrite with `ref`/`reactive`) | ⬜ |
| `useComparisonAPI.ts` | `useComparisonAPI.ts` (rewrite with `ref`/`reactive`) | ⬜ |

### Pages (`src/pages/`)
| File | Vue Component | Status |
|------|--------------|--------|
| `Docs.tsx` | `Docs.vue` | ⬜ |

### Components — Root Level (`src/components/`)
| File | Vue Component | Status |
|------|--------------|--------|
| `LandingPage.tsx` | `LandingPage.vue` | ⬜ |
| `Login.tsx` | `Login.vue` | ⬜ |
| `Auth.tsx` | `Auth.vue` | ⬜ |
| `AuthWrapper.tsx` | `AuthWrapper.vue` | ⬜ |
| `Onboarding.tsx` | `Onboarding.vue` | ⬜ |
| `AdminDashboard.tsx` | `AdminDashboard.vue` | ⬜ |
| `AdminAnalytics.tsx` | `AdminAnalytics.vue` | ⬜ |
| `ChatPane.tsx` | `ChatPane.vue` | ⬜ |
| `DashboardPane.tsx` | `DashboardPane.vue` | ⬜ |
| `LoanCard.tsx` | `LoanCard.vue` | ⬜ |
| `LoanComparisonPane.tsx` | `LoanComparisonPane.vue` | ⬜ |
| `LoanComparisonResults.tsx` | `LoanComparisonResults.vue` | ⬜ |
| `LoanComparisonTable.tsx` | `LoanComparisonTable.vue` | ⬜ |
| `MetricCard.tsx` | `MetricCard.vue` | ⬜ |
| `EmiDonutChart.tsx` | `EmiDonutChart.vue` | ⬜ |
| `AgentTypingIndicator.tsx` | `AgentTypingIndicator.vue` | ⬜ |
| `WhatIfSimulator.tsx` | `WhatIfSimulator.vue` | ⬜ |
| `PerformanceMetrics.tsx` | `PerformanceMetrics.vue` | ⬜ |
| `ReportsPanel.tsx` | `ReportsPanel.vue` | ⬜ |
| `LenderManagement.tsx` | `LenderManagement.vue` | ⬜ |

### Components — Auth (`src/components/auth/`)
| File | Vue Component | Status |
|------|--------------|--------|
| `AuthModal.tsx` | `AuthModal.vue` | ⬜ |
| `ProfileCompletionModal.tsx` | `ProfileCompletionModal.vue` | ⬜ |

### Components — Shared (`src/components/shared/`)
| File | Vue Component | Status |
|------|--------------|--------|
| `AgentOverlay.tsx` | `AgentOverlay.vue` | ⬜ |

### Components — Workspace Layout (`src/components/workspace/layout/`)
| File | Vue Component | Status |
|------|--------------|--------|
| `DashboardLayout.tsx` | `DashboardLayout.vue` | ⬜ |

### Components — Workspace Pages (`src/components/workspace/pages/`)
| File | Vue Component | Status |
|------|--------------|--------|
| `ActiveLoans.tsx` | `ActiveLoans.vue` | ⬜ |
| `AdvisorChat.tsx` | `AdvisorChat.vue` | ⬜ |
| `AnalyticsDashboard.tsx` | `AnalyticsDashboard.vue` | ⬜ |
| `GenUiApplication.tsx` | `GenUiApplication.vue` | ⬜ |
| `LoanApplication.tsx` | `LoanApplication.vue` | ⬜ |
| `UserProfile.tsx` | `UserProfile.vue` | ⬜ |
| `Workspace.tsx` | `Workspace.vue` | ⬜ |

### Components — Workspace Widgets (`src/components/workspace/widgets/`)
| File | Vue Component | Status |
|------|--------------|--------|
| `ActiveContractWidget.tsx` | `ActiveContractWidget.vue` | ⬜ |
| `GraphVisualizer.tsx` | `GraphVisualizer.vue` | ⬜ |
| `KycWidget.tsx` | `KycWidget.vue` | ⬜ |
| `OffersWidget.tsx` | `OffersWidget.vue` | ⬜ |
| `OnboardingWidget.tsx` | `OnboardingWidget.vue` | ⬜ |
| `ProfileWidget.tsx` | `ProfileWidget.vue` | ⬜ |
| `RejectionWidget.tsx` | `RejectionWidget.vue` | ⬜ |
| `SanctionViewer.tsx` | `SanctionViewer.vue` | ⬜ |
| `ShapWidget.tsx` | `ShapWidget.vue` | ⬜ |

---

## 🗺️ Migration Steps (Phase by Phase)

---

### Phase 1 — Project Setup & Config ⬜
Scaffold new Vue project within `frontend/`, swap dependencies, verify dev server boots.

- [ ] **1.1** Install Vue 3 and replace React deps in `package.json`
- [ ] **1.2** Update `vite.config.ts` — replace `@vitejs/plugin-react` with `@vitejs/plugin-vue`
- [ ] **1.3** Update `tsconfig.app.json` — add Vue type support
- [ ] **1.4** Update `eslint.config.js` — swap React rules for Vue plugin rules
- [ ] **1.5** Create `frontend/src/main.ts` (createApp, Pinia, mount)
- [ ] **1.6** Create skeleton `App.vue` with `<template>`, `<script setup lang="ts">`, `<style>`
- [ ] **1.7** Verify dev server runs with `npm run dev`

---

### Phase 2 — State Management (Pinia) ⬜
Migrate Zustand store to Pinia with persist plugin.

- [ ] **2.1** Install `pinia` + `pinia-plugin-persistedstate`
- [ ] **2.2** Create `src/stores/loanStore.ts`
- [ ] **2.3** Export store as `useLoanStore()` composable
- [ ] **2.4** Register Pinia in `main.ts` with `app.use(pinia)`
- [ ] **2.5** Verify store works in browser devtools

---

### Phase 3 — API Layer (Reuse) ⬜
The API client is pure TypeScript — copy as-is.

- [ ] **3.1** Copy `src/api/client.ts` unchanged
- [ ] **3.2** Copy `src/api/websocket.ts` unchanged
- [ ] **3.3** Copy `src/types.ts` → keep as `src/types/index.ts`
- [ ] **3.4** Update all absolute import paths

---

### Phase 4 — Composables (Hooks → Composables) ⬜
React hooks use useState/useEffect — rewrite with Vue ref/reactive/onMounted/watch.

- [ ] **4.1** Migrate `useAdminAPI.ts` → `src/composables/useAdminAPI.ts`
- [ ] **4.2** Migrate `useComparisonAPI.ts` → `src/composables/useComparisonAPI.ts`

---

### Phase 5 — Core Layout & App Shell ⬜
Establish the routing/auth shell so all pages can be dropped in.

- [ ] **5.1** Migrate `App.tsx` → `App.vue`
- [ ] **5.2** Migrate `DashboardLayout.tsx` → `DashboardLayout.vue`
- [ ] **5.3** Migrate `Workspace.tsx` → `Workspace.vue`
- [ ] **5.4** Verify entire shell loads (landing/dashboard toggle)

---

### Phase 6 — Auth Components ⬜
Login, OAuth callback, modals.

- [ ] **6.1** Migrate `LandingPage.tsx` → `LandingPage.vue`
- [ ] **6.2** Migrate `Login.tsx` → `Login.vue`
- [ ] **6.3** Migrate `Auth.tsx` → `Auth.vue`
- [ ] **6.4** Migrate `AuthWrapper.tsx` → `AuthWrapper.vue`
- [ ] **6.5** Migrate `auth/AuthModal.tsx` → `auth/AuthModal.vue`
- [ ] **6.6** Migrate `auth/ProfileCompletionModal.tsx` → `auth/ProfileCompletionModal.vue`
- [ ] **6.7** Verify login + OAuth redirect flow

---

### Phase 7 — Onboarding Flow ⬜
Largest component — multi-step form with agent interactions.

- [ ] **7.1** Migrate `Onboarding.tsx` → `Onboarding.vue`
- [ ] **7.2** Migrate `OnboardingWidget.tsx` → `OnboardingWidget.vue`
- [ ] **7.3** Test full onboarding flow end-to-end

---

### Phase 8 — Chat & AI Advisor ⬜
Complex streaming/WebSocket-driven UI.

- [ ] **8.1** Migrate `ChatPane.tsx` → `ChatPane.vue`
- [ ] **8.2** Migrate `AgentTypingIndicator.tsx` → `AgentTypingIndicator.vue`
- [ ] **8.3** Migrate `AgentOverlay.tsx` → `AgentOverlay.vue`
- [ ] **8.4** Migrate `workspace/pages/AdvisorChat.tsx` → `AdvisorChat.vue`
- [ ] **8.5** Verify WebSocket streaming and chat rendering

---

### Phase 9 — Loan Application & Decision Pages ⬜
KYC, offers, sanctions, rejection flows.

- [ ] **9.1** Migrate `workspace/pages/LoanApplication.tsx` → `LoanApplication.vue`
- [ ] **9.2** Migrate `workspace/pages/GenUiApplication.tsx` → `GenUiApplication.vue`
- [ ] **9.3** Migrate `widgets/KycWidget.tsx` → `KycWidget.vue`
- [ ] **9.4** Migrate `widgets/OffersWidget.tsx` → `OffersWidget.vue`
- [ ] **9.5** Migrate `widgets/RejectionWidget.tsx` → `RejectionWidget.vue`
- [ ] **9.6** Migrate `widgets/SanctionViewer.tsx` → `SanctionViewer.vue`
- [ ] **9.7** Migrate `widgets/ShapWidget.tsx` → `ShapWidget.vue`
- [ ] **9.8** Migrate `widgets/GraphVisualizer.tsx` → `GraphVisualizer.vue`
- [ ] **9.9** Test complete loan application flow

---

### Phase 10 — Dashboard, Charts & Analytics ⬜
Replace Recharts with vue-chartjs / Chart.js.

- [ ] **10.1** Migrate `DashboardPane.tsx` → `DashboardPane.vue`
- [ ] **10.2** Migrate `EmiDonutChart.tsx` → `EmiDonutChart.vue`
- [ ] **10.3** Migrate `workspace/pages/AnalyticsDashboard.tsx` → `AnalyticsDashboard.vue`
- [ ] **10.4** Migrate `PerformanceMetrics.tsx` → `PerformanceMetrics.vue`
- [ ] **10.5** Migrate `MetricCard.tsx` → `MetricCard.vue`
- [ ] **10.6** Migrate `WhatIfSimulator.tsx` → `WhatIfSimulator.vue`
- [ ] **10.7** Migrate `workspace/pages/ActiveLoans.tsx` → `ActiveLoans.vue`
- [ ] **10.8** Migrate `widgets/ActiveContractWidget.tsx` → `ActiveContractWidget.vue`
- [ ] **10.9** Verify charts render correctly

---

### Phase 11 — User Profile & Settings ⬜

- [ ] **11.1** Migrate `workspace/pages/UserProfile.tsx` → `UserProfile.vue`
- [ ] **11.2** Migrate `widgets/ProfileWidget.tsx` → `ProfileWidget.vue`

---

### Phase 12 — Admin Panel ⬜

- [ ] **12.1** Migrate `AdminDashboard.tsx` → `AdminDashboard.vue`
- [ ] **12.2** Migrate `AdminAnalytics.tsx` → `AdminAnalytics.vue`
- [ ] **12.3** Migrate `LenderManagement.tsx` → `LenderManagement.vue`
- [ ] **12.4** Migrate `ReportsPanel.tsx` → `ReportsPanel.vue`
- [ ] **12.5** Verify admin flow

---

### Phase 13 — Loan Comparison ⬜

- [ ] **13.1** Migrate `LoanComparisonPane.tsx` → `LoanComparisonPane.vue`
- [ ] **13.2** Migrate `LoanComparisonResults.tsx` → `LoanComparisonResults.vue`
- [ ] **13.3** Migrate `LoanComparisonTable.tsx` → `LoanComparisonTable.vue`
- [ ] **13.4** Migrate `LoanCard.tsx` → `LoanCard.vue`
- [ ] **13.5** Verify loan comparison feature

---

### Phase 14 — Documentation Page ⬜

- [ ] **14.1** Migrate `pages/Docs.tsx` → `pages/Docs.vue`

---

### Phase 15 — Final Polish & QA ⬜

- [ ] **15.1** Remove all React packages from `package.json`
- [ ] **15.2** Search codebase for any remaining `.tsx` files — convert or delete
- [ ] **15.3** Run `npm run build` — fix all TypeScript/build errors
- [ ] **15.4** Run `npm run lint` — fix all linting errors
- [ ] **15.5** Full E2E test: Landing → Login → Onboarding → Chat → Sanction → Active Loan
- [ ] **15.6** Admin flow test
- [ ] **15.7** Loan Comparison flow test
- [ ] **15.8** Docs page test
- [ ] **15.9** Update `README.md` with new Vue stack info

---

## 🔄 React → Vue 3 Cheat Sheet

| React | Vue 3 Equivalent |
|-------|-----------------|
| `useState(val)` | `const x = ref(val)` |
| `useRef(null)` | `const el = ref<HTMLElement \| null>(null)` |
| `useEffect(() => {}, [])` | `onMounted(() => {})` |
| `useEffect(() => {}, [dep])` | `watch(dep, () => {})` |
| `useCallback(fn, [deps])` | Plain function (reactivity is automatic) |
| `useMemo(fn, [deps])` | `computed(() => fn())` |
| `props.children` | `<slot />` |
| `className="..."` | `class="..."` |
| `onClick={handler}` | `@click="handler"` |
| `onChange={handler}` | `@change="handler"` or `v-model` |
| `{condition && <Comp />}` | `<Comp v-if="condition" />` |
| `{list.map(item => </>)}` | `<div v-for="item in list" :key="item.id">` |
| `<motion.div animate={...}>` | `<div v-motion :initial="{}" :enter="{}">` |
| Zustand `create(...)` | `defineStore(...)` (Pinia) |
| `useStore(state => state.x)` | `storeToRefs(useLoanStore())` |
| `React.FC<Props>` | `defineProps<Props>()` |
| `forwardRef` | `defineExpose({})` |
| Context API | Pinia or `provide` / `inject` |
| `lucide-react` | `lucide-vue-next` |
| `recharts` | `vue-chartjs` + `chart.js` |
| `react-markdown` | `vue3-markdown-it` |
| `react-countup` | `vue-countup-v3` |
| `framer-motion` | `@vueuse/motion` |

---

## ⚠️ Known Challenges

1. **`GenUiApplication.tsx`** (28KB) — Large complex component with dynamic AI-generated UI rendering. Vue's `<component :is>` and `v-html` will be needed carefully.
2. **`ChatPane.tsx`** (27KB) — Streaming SSE/WebSocket updates; ensure reactivity is correctly set up.
3. **`Onboarding.tsx`** (25KB) — Multi-step wizard with animations; Framer Motion → `@vueuse/motion` or CSS transitions.
4. **shadcn/ui** — React-specific; Vue equivalent is **shadcn-vue** (`shadcn-vue.com`). Components must be re-generated.
5. **`canvas-confetti`** — Framework agnostic, reuse directly.
6. **Pinia Persist** — Map Zustand's `partialize` to Pinia's `persist: { paths: [...] }`.

---

## 📦 New `package.json` Dependencies (Target)

```json
{
  "dependencies": {
    "vue": "^3.5.0",
    "pinia": "^2.2.0",
    "pinia-plugin-persistedstate": "^4.0.0",
    "@vueuse/core": "^12.0.0",
    "@vueuse/motion": "^2.2.0",
    "lucide-vue-next": "^0.477.0",
    "vue-chartjs": "^5.3.0",
    "chart.js": "^4.4.0",
    "vue3-markdown-it": "^1.0.0",
    "vue-countup-v3": "^2.0.0",
    "canvas-confetti": "^1.9.4",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.5.0",
    "class-variance-authority": "^0.7.1"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "@vue/tsconfig": "^0.7.0",
    "typescript": "~5.9.3",
    "vite": "^5.4.21",
    "tailwindcss": "^3.4.19",
    "postcss": "^8.5.8",
    "autoprefixer": "^10.4.27"
  }
}
```

---

## 🏁 Completion Tracker

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Project Setup & Config | ⬜ |
| Phase 2 | Pinia State Store | ⬜ |
| Phase 3 | API Layer (Reuse) | ⬜ |
| Phase 4 | Composables | ⬜ |
| Phase 5 | App Shell & Layout | ⬜ |
| Phase 6 | Auth Components | ⬜ |
| Phase 7 | Onboarding Flow | ⬜ |
| Phase 8 | Chat & AI Advisor | ⬜ |
| Phase 9 | Loan Application & Decisions | ⬜ |
| Phase 10 | Dashboard, Charts & Analytics | ⬜ |
| Phase 11 | User Profile | ⬜ |
| Phase 12 | Admin Panel | ⬜ |
| Phase 13 | Loan Comparison | ⬜ |
| Phase 14 | Documentation Page | ⬜ |
| Phase 15 | Final QA & Cleanup | ⬜ |

---

*Generated: 2026-10-12 — LoanNBFC Vue Migration*
