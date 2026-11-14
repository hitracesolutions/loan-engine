import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppState = 'UNAUTHENTICATED' | 'AUTHENTICATED';

export type DashboardView =
  | 'DASHBOARD'
  | 'APPLICATION'
  | 'STAFF_INTAKE'
  | 'LENDER_PORTAL'
  | 'LENDER_REGISTER'
  | 'AGENCY_QUEUE'
  | 'ACTIVE_LOANS'
  | 'PROFILE'
  | 'DOCS';

export type ThemePreference = 'light' | 'dark';
export type LanguagePreference = 'en' | 'fr' | 'tw';

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
  phone?: string;
  salary?: number;
  city?: string;
  role?: string;
}

interface LoanStore {
  currentView: DashboardView;
  currentState: AppState;
  user: UserProfile | null;
  theme: ThemePreference;
  language: LanguagePreference;
  setView: (view: DashboardView) => void;
  setState: (state: AppState) => void;
  setUser: (user: UserProfile) => void;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: LanguagePreference) => void;
  clearSession: () => void;
}

export const useLoanStore = create<LoanStore>()(
  persist(
    (set) => ({
      currentView: 'DASHBOARD',
      currentState: 'UNAUTHENTICATED',
      user: null,
      theme: 'light',
      language: 'en',

      setView: (view) => set({ currentView: view }),
      setState: (state) => set({ currentState: state }),
      setUser: (user) => set({ user, currentState: 'AUTHENTICATED' }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      clearSession: () =>
        set({
          currentView: 'DASHBOARD',
          currentState: 'UNAUTHENTICATED',
          user: null,
        }),
    }),
    {
      name: 'gidfine-session',
      partialize: (state) => ({
        currentState: state.currentState,
        user: state.user,
        currentView: state.currentView,
        theme: state.theme,
        language: state.language,
      }),
    },
  ),
);
