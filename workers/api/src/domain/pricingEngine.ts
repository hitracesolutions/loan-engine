/**
 * Deterministic Pricing and Repayment Schedule Engine.
 *
 * Implements integer-pesewas safe calculation strategies for loan simulation.
 * In accordance with owner decision boundaries (O-03, O-04), commercial formulas
 * remain explicitly configurable and all generated quotes are tagged as simulations
 * (is_simulation = 1, status = 'PROVISIONAL') until formal commercial sign-off.
 */

import { splitPesewas } from '../lib/money.ts';

export type CalculationStrategy = 'FLAT_SIMULATION' | 'REDUCING_BALANCE_SIMULATION';

export interface RepaymentInstallmentQuote {
  installmentNumber: number;
  principalPesewas: number;
  interestPesewas: number;
  feesPesewas: number;
  totalPesewas: number;
}

export interface QuoteCalculationResult {
  principalPesewas: number;
  nominalAnnualRateBps: number;
  tenureMonths: number;
  calculationStrategy: CalculationStrategy;
  totalInterestPesewas: number;
  totalFeesPesewas: number;
  totalRepayablePesewas: number;
  monthlyRepaymentPesewas: number;
  installments: RepaymentInstallmentQuote[];
  isSimulation: boolean;
  snapshotHash: string;
}

export async function calculateQuote(params: {
  principalPesewas: number;
  nominalAnnualRateBps: number;
  tenureMonths: number;
  calculationStrategy?: CalculationStrategy;
  originationFeeBps?: number;
}): Promise<QuoteCalculationResult> {
  const {
    principalPesewas,
    nominalAnnualRateBps,
    tenureMonths,
    calculationStrategy = 'FLAT_SIMULATION',
    originationFeeBps = 0,
  } = params;

  if (principalPesewas <= 0 || !Number.isSafeInteger(principalPesewas)) {
    throw new RangeError('principalPesewas must be a positive integer');
  }
  if (tenureMonths <= 0 || !Number.isSafeInteger(tenureMonths)) {
    throw new RangeError('tenureMonths must be a positive integer');
  }
  if (nominalAnnualRateBps < 0 || nominalAnnualRateBps > 10000) {
    throw new RangeError('nominalAnnualRateBps must be between 0 and 10000');
  }

  // Fees calculation (integer pesewas)
  const totalFeesPesewas = Math.round((principalPesewas * originationFeeBps) / 10000);
  const feeSplits = splitPesewas(totalFeesPesewas, tenureMonths);

  let totalInterestPesewas = 0;
  let principalSplits: number[] = [];
  let interestSplits: number[] = [];

  if (calculationStrategy === 'FLAT_SIMULATION') {
    // Flat Rate Simulation: Interest = (P * RateBps * TenureMonths) / (12 * 10000)
    // 120000 bps-months in 100% per year
    totalInterestPesewas = Math.round((principalPesewas * nominalAnnualRateBps * tenureMonths) / 120000);
    principalSplits = splitPesewas(principalPesewas, tenureMonths);
    interestSplits = splitPesewas(totalInterestPesewas, tenureMonths);
  } else {
    // Reducing balance simulation with exact integer rounding
    // Monthly rate in fraction = nominalAnnualRateBps / 120000
    const monthlyRate = nominalAnnualRateBps / 120000;
    if (monthlyRate === 0) {
      principalSplits = splitPesewas(principalPesewas, tenureMonths);
      interestSplits = Array(tenureMonths).fill(0);
    } else {
      let balance = principalPesewas;
      // standard annuity monthly payment approximation
      const pmt = (principalPesewas * (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths))) /
                  (Math.pow(1 + monthlyRate, tenureMonths) - 1);
      const roundedPmt = Math.round(pmt);

      for (let i = 1; i <= tenureMonths; i++) {
        const monthlyInterest = Math.round(balance * monthlyRate);
        totalInterestPesewas += monthlyInterest;
        interestSplits.push(monthlyInterest);

        if (i === tenureMonths) {
          principalSplits.push(balance);
        } else {
          const principalPortion = Math.min(balance, roundedPmt - monthlyInterest);
          principalSplits.push(principalPortion);
          balance -= principalPortion;
        }
      }
    }
  }

  const totalRepayablePesewas = principalPesewas + totalInterestPesewas + totalFeesPesewas;
  const installments: RepaymentInstallmentQuote[] = [];

  for (let i = 0; i < tenureMonths; i++) {
    const p = principalSplits[i];
    const intr = interestSplits[i];
    const f = feeSplits[i];
    installments.push({
      installmentNumber: i + 1,
      principalPesewas: p,
      interestPesewas: intr,
      feesPesewas: f,
      totalPesewas: p + intr + f,
    });
  }

  // Monthly repayment metric for display
  const monthlyRepaymentPesewas = installments[0]?.totalPesewas ?? 0;

  // Compute canonical deterministic SHA-256 snapshot hash
  const canonicalData = JSON.stringify({
    principalPesewas,
    nominalAnnualRateBps,
    tenureMonths,
    calculationStrategy,
    totalInterestPesewas,
    totalFeesPesewas,
    totalRepayablePesewas,
    monthlyRepaymentPesewas,
    installments,
  });

  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalData));
  const snapshotHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    principalPesewas,
    nominalAnnualRateBps,
    tenureMonths,
    calculationStrategy,
    totalInterestPesewas,
    totalFeesPesewas,
    totalRepayablePesewas,
    monthlyRepaymentPesewas,
    installments,
    isSimulation: true,
    snapshotHash,
  };
}
