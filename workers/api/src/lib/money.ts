/**
 * Money and rate arithmetic.
 *
 * All monetary values are integer pesewas (GH₵ 1.00 = 100 pesewas) and all
 * rates are integer basis points (1% = 100 bps). Floating point is never used
 * for stored or transmitted financial values.
 */

import { badRequest } from './http.ts';

const PESEWAS_PER_CEDI = 100;

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function assertPositivePesewas(value: unknown, field: string): number {
  if (!isPositiveInteger(value)) {
    throw badRequest(
      'INVALID_AMOUNT',
      `${field} must be a positive integer amount in pesewas`,
    );
  }
  return value;
}

export function assertPositiveInteger(value: unknown, field: string, max: number): number {
  if (!isPositiveInteger(value) || value > max) {
    throw badRequest('INVALID_INTEGER', `${field} must be an integer between 1 and ${max}`);
  }
  return value;
}

export function cediToPesewas(cedis: number): number {
  return Math.round(cedis * PESEWAS_PER_CEDI);
}

export function formatCedis(pesewas: number): string {
  return (pesewas / PESEWAS_PER_CEDI).toFixed(2);
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/** Splits an amount across n equal parts, pushing the rounding remainder into the last part. */
export function splitPesewas(totalPesewas: number, parts: number): number[] {
  if (!Number.isSafeInteger(totalPesewas) || totalPesewas < 0) {
    throw new RangeError('totalPesewas must be a non-negative integer');
  }
  if (!Number.isSafeInteger(parts) || parts <= 0) {
    throw new RangeError('parts must be a positive integer');
  }

  const base = Math.floor(totalPesewas / parts);
  const result = Array.from({ length: parts }, () => base);
  result[parts - 1] = totalPesewas - base * (parts - 1);
  return result;
}
