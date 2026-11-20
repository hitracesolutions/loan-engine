import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useTranslation } from '../lib/useTranslation';
import { Lock, CheckCircle2 } from 'lucide-react';

interface PrivacyProps {
  onNavigate?: (path: string) => void;
}

export default function Privacy({ onNavigate }: PrivacyProps) {
  const { tx } = useTranslation();

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">
      <Navbar onNavigate={onNavigate} />

      <main className="py-16 md:py-24 px-5">
        <div className="mx-auto max-w-4xl">
          
          {/* Header */}
          <div className="mb-12 pb-8 border-b border-gray-100">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-950">
              {tx('Privacy Policy & Data Protection')}
            </h1>
            <p className="mt-4 text-base text-gray-500 leading-relaxed">
              {tx('Compliant with the Data Protection Act, 2012 (Act 843) of the Republic of Ghana. Effective Date: November 2026.')}
            </p>
          </div>

          {/* Legal Content */}
          <div className="space-y-10 text-base leading-relaxed text-gray-700">
            
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">1. Overview & Data Controller</h2>
              <p>
                Gidfine.gh (&ldquo;Gidfine&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates a digital multi-lender credit intermediary platform hosted at <a href="https://gidfin.dekacentral.com/" className="text-[#0d3d38] font-semibold underline">https://gidfin.dekacentral.com/</a>. We act as a registered Data Controller under the Data Protection Act, 2012 (Act 843) of the Republic of Ghana.
              </p>
              <p>
                This Privacy Policy explains how we collect, process, encrypt, and safeguard your personal information when you use our website, apply for loan comparisons, and interact with our partner lender network.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">2. Information We Collect</h2>
              <p>To evaluate creditworthiness and match you with licensed Ghanaian lenders, we collect the following categories of personal data:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-600">
                <li><strong className="text-gray-900">Identity Data:</strong> Full legal name, date of birth, residential address, and Ghana Card (National Identification) number.</li>
                <li><strong className="text-gray-900">Contact Data:</strong> Primary Ghanaian mobile telephone number (verified via one-time SMS passcodes) and email address.</li>
                <li><strong className="text-gray-900">Financial & Employment Data:</strong> Employer name, employment type (salaried, civil service, or SME business owner), monthly net income, bank account details, and mobile money wallet identifiers.</li>
                <li><strong className="text-gray-900">Technical Logs:</strong> IP address, device telemetry, browser type, and cryptographic audit timestamps for fraud prevention.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">3. Purpose of Processing & Legal Basis</h2>
              <p>We process your personal information under the lawful grounds established in Act 843 Section 18:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-600">
                <li>To assess borrowing eligibility and generate real-time loan offers through our pricing engine.</li>
                <li>To fulfill statutory Know Your Customer (KYC) and Anti-Money Laundering (AML) mandates required by Ghanaian banking laws.</li>
                <li>To route anonymized application profiles to participating licensed commercial banks and regulated microfinance institutions.</li>
                <li>To send transactional updates regarding offer approvals, repayment schedules, and loan disbursement status.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">4. PII Masking & Lender Disclosures</h2>
              <p>
                We enforce strict data minimization. During the preliminary offer quotation stage, partner lenders receive only a sanitized, masked summary of your financial metrics (income bracket, debt-to-income ratio, and requested loan parameters). Your raw Ghana Card number, full residential address, and contact details are withheld until you explicitly choose to accept a binding offer.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">5. Security & Encryption Standards</h2>
              <div className="rounded-2xl bg-[#f0f8f7] border border-[#38c9c0]/30 p-5 flex items-start gap-4">
                <Lock className="h-6 w-6 text-[#0d3d38] shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-gray-950">Bank-Grade 256-bit AES Encryption</p>
                  <p className="text-gray-600 mt-1 leading-relaxed">
                    All personal data and documents at rest are encrypted with AES-256 keys. Network transmissions are protected using TLS 1.3 protocol. Access to borrower data within Gidfine is restricted through strict role-based access controls and logged to tamper-evident audit tables.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">6. Your Rights Under Act 843</h2>
              <p>As a data subject in Ghana, you are entitled to statutory rights under the Data Protection Act:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-600">
                <li><strong className="text-gray-900">Right of Access:</strong> Request a complete copy of all personal records held in your borrower file.</li>
                <li><strong className="text-gray-900">Right to Rectification:</strong> Request correction of inaccurate, incomplete, or outdated employment and contact details.</li>
                <li><strong className="text-gray-900">Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Request deletion of your profile, subject to statutory loan record-keeping retention periods required under Bank of Ghana financial regulations.</li>
                <li><strong className="text-gray-900">Right to Object:</strong> Withdraw consent for marketing and newsletter communications at any time with a single click.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">7. Data Protection Officer Contact</h2>
              <p>
                For any privacy questions, data access requests, or regulatory inquiries, contact our Data Protection Officer directly:
              </p>
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5 text-sm">
                <p className="font-bold text-gray-950">Gidfine Privacy & Compliance Desk</p>
                <p className="text-gray-600 mt-0.5">Accra, Greater Accra Region, Republic of Ghana</p>
                <p className="text-gray-900 font-semibold mt-2">Email: <a href="mailto:support@gidfin.dekacentral.com" className="text-[#0d3d38] underline">support@gidfin.dekacentral.com</a></p>
              </div>
            </section>

          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
