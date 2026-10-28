/**
 * Cache Service — Cloudflare KV Wrapper
 * Handles all caching operations for Gidfine
 */

import type { CloudflareEnv } from "../types";

// ============================================
// CACHE KEYS
// ============================================

export const CACHE_KEYS = {
  // Lender rates (6 hours)
  lenderRates: (lenderId: string) => `lender:${lenderId}:rates`,

  // Repayment schedule (1 hour)
  loanSchedule: (loanId: string) => `loan:${loanId}:schedule`,

  // Fraud score (30 minutes)
  fraudScore: (borrowerId: string) => `fraud:${borrowerId}:score`,

  // Idempotency (prevent duplicate payments - 24 hours)
  paymentIdempotent: (key: string) => `payment:idempotent:${key}`,

  // Rate limiting (1 hour)
  rateLimit: (borrowerId: string) => `rate-limit:${borrowerId}`,

  // User session (1 hour)
  userSession: (userId: string) => `session:${userId}`,
};

// ============================================
// CACHE EXPIRATION TIMES (in seconds)
// ============================================

export const CACHE_TTL = {
  LENDER_RATES: 6 * 60 * 60, // 6 hours
  LOAN_SCHEDULE: 60 * 60, // 1 hour
  FRAUD_SCORE: 30 * 60, // 30 minutes
  PAYMENT_IDEMPOTENT: 24 * 60 * 60, // 24 hours
  RATE_LIMIT: 60 * 60, // 1 hour
  SESSION: 60 * 60, // 1 hour
};

// ============================================
// CACHE OPERATIONS
// ============================================

/**
 * Set a value in cache
 */
export async function cacheSet(
  env: CloudflareEnv,
  key: string,
  value: any,
  ttl: number = 3600
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    await env.CACHE.put(key, serialized, {
      expirationTtl: ttl,
    });
    console.log(`[CACHE] Set: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error(`[CACHE] Error setting ${key}:`, error);
    // Fail silently — cache is optional, continue execution
  }
}

/**
 * Get a value from cache
 */
export async function cacheGet(
  env: CloudflareEnv,
  key: string
): Promise<any | null> {
  try {
    const value = await env.CACHE.get(key);
    if (value) {
      console.log(`[CACHE] Hit: ${key}`);
      return JSON.parse(value);
    }
    console.log(`[CACHE] Miss: ${key}`);
    return null;
  } catch (error) {
    console.error(`[CACHE] Error getting ${key}:`, error);
    return null;
  }
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(
  env: CloudflareEnv,
  key: string
): Promise<void> {
  try {
    await env.CACHE.delete(key);
    console.log(`[CACHE] Deleted: ${key}`);
  } catch (error) {
    console.error(`[CACHE] Error deleting ${key}:`, error);
  }
}

/**
 * Clear specific cache key
 */
export async function cacheClear(
  env: CloudflareEnv,
  key: string
): Promise<void> {
  await cacheDelete(env, key);
}

// ============================================
// CACHE HELPERS
// ============================================

/**
 * Get or set pattern (cache-aside)
 */
export async function cacheGetOrSet(
  env: CloudflareEnv,
  key: string,
  fetchFn: () => Promise<any>,
  ttl: number = 3600
): Promise<any> {
  // Try cache first
  const cached = await cacheGet(env, key);
  if (cached) return cached;

  // Cache miss — fetch and store
  const value = await fetchFn();
  await cacheSet(env, key, value, ttl);
  return value;
}

/**
 * Check if key exists in cache
 */
export async function cacheExists(
  env: CloudflareEnv,
  key: string
): Promise<boolean> {
  const value = await env.CACHE.get(key);
  return value !== null;
}

/**
 * Increment counter in cache
 */
export async function cacheIncrement(
  env: CloudflareEnv,
  key: string,
  ttl: number = 3600
): Promise<number> {
  const current = (await cacheGet(env, key)) || 0;
  const next = current + 1;
  await cacheSet(env, key, next, ttl);
  return next;
}

/**
 * Decrement counter in cache
 */
export async function cacheDecrement(
  env: CloudflareEnv,
  key: string,
  ttl: number = 3600
): Promise<number> {
  const current = (await cacheGet(env, key)) || 0;
  const next = Math.max(0, current - 1);
  await cacheSet(env, key, next, ttl);
  return next;
}
