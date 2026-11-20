import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useTranslation } from '../lib/useTranslation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface TermsProps {
  onNavigate?: (path: string) => void;
}

export default function Terms({ onNavigate }: TermsProps) {
  const { tx } = useTranslation();

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">
      <Navbar onNavigate={onNavigate} />

      <main className="py-16 md:py-24 px-5">
        <div className="mx-auto max-w-4xl">
          
          {/* Header */}
          <div className="mb-12 pb-8 border-b border-gray-100">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-950">
              {tx('Terms of Service')}
            </h1>
            <p className="mt-4 text-base text-gray-500 leading-relaxed">
              {tx('Effective Date: November 2026 · Applicable to all loan applicants and users in Ghana.')}
            </p>
          </div>

          {/* Legal Content */}
          <div className="space-y-10 text-base leading-relaxed text-gray-700">
            
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">1. Credit Intermediary Disclosure</h2>
              <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-5 text-sm text-amber-950 leading-relaxed flex items-start gap-3.5">
                <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Important Regulatory Notice</p>
                  <p className="mt-1">
                    Gidfine (<a href="https://gidfin.dekacentral.com/" className="font-semibold underline">https://gidfin.dekacentral.com/</a>) is an independent credit intermediary platform. Gidfine does NOT issue loans directly, does NOT take deposits, and does NOT determine final credit underwriting criteria. Loans are originated, underwritten, and disbursed exclusively by our partner commercial banks and regulated financial institutions licensed by the Bank of Ghana.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">2. Zero Upfront Fee Guarantee</h2>
              <p>
                Gidfine provides loan application matching and quote comparison completely free of charge to borrowers.
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-600">
                <li>We do NOT charge upfront registration fees, processing fees, or loan inspection fees.</li>
                <li>We do NOT solicit cash payments via unofficial mobile money accounts.</li>
                <li>If any third party or individual demands an upfront cash deposit claiming to represent Gidfine, refuse the request immediately and report them to <span className="font-semibold text-gray-900">support@gidfin.dekacentral.com</span>.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">3. Applicant Eligibility</h2>
              <p>To use our services and submit credit applications, you represent and warrant that:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-600">
                <li>You are at least eighteen (18) years of age.</li>
                <li>You are a citizen or permanent legal resident of the Republic of Ghana.</li>
                <li>You possess a valid, verifiable Ghana Card issued by the National Identification Authority (NIA).</li>
                <li>You have an active bank account or registered Mobile Money wallet (MTN, Telecel, or AT) in your own legal name.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">4. Accuracy of Information & Fraud Prevention</h2>
              <p>
                You agree to provide true, accurate, current, and complete information regarding your identity, employment, and income. Knowingly providing forged documents, fabricated pay slips, or impersonating another citizen is a criminal offense under the laws of Ghana and will result in immediate permanent disqualification, reporting to the Ghana Police Service, and blacklisting across our lender network.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">5. Loan Offers & Repayment Contracts</h2>
              <p>
                Any loan quote presented on Gidfine represents an initial indication based on your application criteria. When you choose to accept an offer, you will be presented with the lender&rsquo;s formal credit agreement. Your binding legal obligation to repay the principal, interest, and any agreed statutory statutory levies is strictly governed by that agreement with the underwriting lender.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">6. Bank of Ghana Consumer Protection Principles</h2>
              <p>
                All partner lenders participating in Gidfine are required to abide by Bank of Ghana consumer protection standards. Borrowers are entitled to full disclosure of the Annual Percentage Rate (APR), repayment frequencies, total cost of credit, and grace periods prior to loan disbursement.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-950 tracking-tight">7. Governing Law</h2>
              <p>
                These Terms of Service and any non-contractual obligations arising out of or in connection with them shall be governed by and construed in accordance with the laws of the Republic of Ghana. Any disputes shall be subject to the exclusive jurisdiction of the Courts of Ghana.
              </p>
            </section>

          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
