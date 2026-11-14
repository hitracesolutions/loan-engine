import type { LanguagePreference } from '../store/useLoanStore';

const messages = {
  en: {
    workspace: 'Finance workspace', overview: 'Overview', applications: 'Applications', reviewQueue: 'Review queue',
    borrowerIntake: 'Borrower intake', loansLedgers: 'Loans & ledgers', registerLender: 'Register lender', proposals: 'Proposals',
    notificationsLater: 'Notifications coming later', accountMenu: 'Account menu', profileSettings: 'Profile settings',
    accountPreferences: 'Account preferences', appearance: 'Appearance', themeHelp: 'Choose your workspace theme', light: 'Light mode', dark: 'Dark mode',
    language: 'Language', logout: 'Log out', welcome: 'Welcome back', dashboardIntro: 'Track your loan applications, active loans and repayment status.',
    applyLoan: 'Apply for a loan', totalOutstanding: 'Total outstanding', activeLoans: 'Active loans', recentApplications: 'Recent applications',
    loading: 'Loading\u2026', noApplications: 'No applications yet. Apply for a loan to get started.', reference: 'Reference', date: 'Date', amount: 'Amount', status: 'Status',
  },
  fr: {
    workspace: 'Espace financier', overview: 'Vue d\u2019ensemble', applications: 'Demandes', reviewQueue: 'File de v\u00e9rification',
    borrowerIntake: 'Inscription emprunteur', loansLedgers: 'Pr\u00eats et grands livres', registerLender: 'Inscrire un pr\u00eateur', proposals: 'Offres',
    notificationsLater: 'Notifications bient\u00f4t disponibles', accountMenu: 'Menu du compte', profileSettings: 'Param\u00e8tres du profil',
    accountPreferences: 'Pr\u00e9f\u00e9rences du compte', appearance: 'Apparence', themeHelp: 'Choisissez le th\u00e8me de votre espace', light: 'Mode clair', dark: 'Mode sombre',
    language: 'Langue', logout: 'Se d\u00e9connecter', welcome: 'Bon retour', dashboardIntro: 'Suivez vos demandes de pr\u00eat, vos pr\u00eats actifs et vos remboursements.',
    applyLoan: 'Demander un pr\u00eat', totalOutstanding: 'Solde total \u00e0 rembourser', activeLoans: 'Pr\u00eats actifs', recentApplications: 'Demandes r\u00e9centes',
    loading: 'Chargement\u2026', noApplications: 'Aucune demande pour le moment. Faites une demande de pr\u00eat pour commencer.', reference: 'R\u00e9f\u00e9rence', date: 'Date', amount: 'Montant', status: 'Statut',
  },
  tw: {
    workspace: 'Gidikatu adwumay\u025bbea', overview: 'Ns\u025bm nyinaa', applications: 'Akwammisa', reviewQueue: 'Nhw\u025bmu kuo',
    borrowerIntake: 'Osika-gyefo din-kyer\u025bw', loansLedgers: 'Asetena ne akontaabu', registerLender: 'Kyer\u025bw bosea-mafo\u0254', proposals: 'Nhy\u025bso\u0254',
    notificationsLater: 'Amanne\u025bb\u0254 b\u025bba akyiri yi', accountMenu: 'Akontaabu menu', profileSettings: 'Wo ho ns\u025bm nhyehy\u025be',
    accountPreferences: 'Akontaabu nhyehy\u025be', appearance: '\u0190y\u025bbea', themeHelp: 'Paw wo dwumadie beae\u025b kanea', light: 'Kanea tebea', dark: 'Sum tebea',
    language: 'Kasa', logout: 'Pue firi mu', welcome: 'Y\u025bma wo akwaaba bio', dashboardIntro: 'Hw\u025b wo bosea akwammisa, bosea a \u025bda so, ne sika a wode tua.',
    applyLoan: 'Bisa bosea', totalOutstanding: 'Sika a aka s\u025b wob\u025btua nyinaa', activeLoans: 'Bosea a \u025bda so', recentApplications: 'Akwammisa fofor\u0254',
    loading: '\u0190reba\u2026', noApplications: 'Wonni akwammisa biara seesei. Bisa bosea na woafiri ase.', reference: 'N\u0254ma', date: 'Da', amount: 'Sika dodow', status: 'Tebea',
  },
} satisfies Record<LanguagePreference, Record<string, string>>;

export type TranslationKey = keyof typeof messages.en;

export function translate(language: LanguagePreference, key: TranslationKey): string {
  return messages[language][key] ?? messages.en[key];
}
