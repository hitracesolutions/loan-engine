import { defineStore } from 'pinia';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppState =
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'PROFILE_COMPLETION'
  | 'ONBOARDING'
  | 'DOCUMENT_COLLECTION'
  | 'DECISION_READY'
  | 'ACTIVE_LOAN';

export type DashboardView =
  | 'DASHBOARD'
  | 'APPLICATION'
  | 'ACTIVE_LOANS'
  | 'ADVISOR'
  | 'PROFILE'
  | 'DOCS';

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
  phone?: string;
  salary?: number;
  city?: string;
  creditScore?: number;
  pan?: string;
  aadhaar?: string;
  preApprovedLimit?: number;
}

export interface LoanDetails {
  requestedAmount: number;
  tenureMonths: number;
  purpose?: string;
  sanctionedAmount?: number;
  interestRate?: number;
  monthlyEmi?: number;
}

export interface Document {
  id: string;
  type: 'PAN' | 'AADHAAR';
  status: 'UPLOADED' | 'VERIFIED' | 'REJECTED';
  extractedData?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  component?: string;
  timestamp: number;
  graphTrace?: string[];
  pdfDownloadUrl?: string;
  pdfLabel?: string;
  showShapPill?: boolean;
  allLenderRules?: unknown[];
  showRulesButton?: boolean;
  uiTrigger?: 'INITIAL_OFFERS' | 'REJECTION' | 'FINAL_LENDER';
  disbursementDetails?: unknown;
  decision?: string;
  reasons?: string[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLoanStore = defineStore('nbfc-session', {
  state: () => ({
    currentView: 'DASHBOARD' as DashboardView,
    sessionId: null as string | null,
    isAgentActive: false,
    agentLogs: [] as string[],
    currentState: 'UNAUTHENTICATED' as AppState,
    user: null as UserProfile | null,
    loanDetails: { requestedAmount: 500000, tenureMonths: 36 } as LoanDetails,
    documents: [] as Document[],
    chatHistory: [] as ChatMessage[],
  }),

  actions: {
    setView(view: DashboardView) {
      this.currentView = view;
    },

    setSessionId(id: string) {
      this.sessionId = id;
    },

    setAgentActive(active: boolean) {
      this.isAgentActive = active;
    },

    addAgentLog(log: string) {
      this.agentLogs.push(log);
    },

    clearAgentLogs() {
      this.agentLogs = [];
    },

    setState(state: AppState) {
      this.currentState = state;
    },

    setUser(user: UserProfile) {
      this.user = user;
      this.currentState = 'AUTHENTICATED';
    },

    updateLoanDetails(details: Partial<LoanDetails>) {
      this.loanDetails = { ...this.loanDetails, ...details };
    },

    addDocument(doc: Document) {
      this.documents.push(doc);
    },

    updateDocument(id: string, updates: Partial<Document>) {
      const idx = this.documents.findIndex((d) => d.id === id);
      if (idx !== -1) {
        this.documents[idx] = { ...this.documents[idx], ...updates };
      }
    },

    addChatMessage(msg: ChatMessage) {
      this.chatHistory.push(msg);
    },

    clearSession() {
      this.currentView = 'DASHBOARD';
      this.currentState = 'UNAUTHENTICATED';
      this.user = null;
      this.sessionId = null;
      this.loanDetails = { requestedAmount: 500000, tenureMonths: 36 };
      this.documents = [];
      this.chatHistory = [];
      this.isAgentActive = false;
      this.agentLogs = [];
    },
  },

  // Persist only the fields needed to restore session across page reloads
  persist: {
    pick: ['currentState', 'user', 'sessionId', 'currentView'],
  },
});
