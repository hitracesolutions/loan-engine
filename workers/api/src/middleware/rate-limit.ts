/**
 * Rate Limit Middleware — Fraud Detection & DoS Protection
 * Tracks requests per borrower/IP to prevent abuse
 */

import type { CloudflareEnv } from "../types";
import { cacheGet, cacheSet, CACHE_TTL } from "../services/cache";

// ============================================
// RATE LIMIT CONFIG
// ============================================

export const RATE_LIMITS = {
  // Borrower application submissions (per hour)
  APPLICATION_SUBMIT: {
    limit: 5,
    window: CACHE_TTL.RATE_LIMIT,
    message: "Too many application submissions. Please try again in 1 hour.",
  },

  // Document uploads (per hour)
  DOCUMENT_UPLOAD: {
    limit: 20,
    window: CACHE_TTL.RATE_LIMIT,
    message: "Too many document uploads. Please try again in 1 hour.",
  },

  // Login attempts (per hour)
  LOGIN_ATTEMPT: {
    limit: 10,
    window: CACHE_TTL.RATE_LIMIT,
    message: "Too many login attempts. Please try again in 1 hour.",
  },

  // Payment submissions (per day)
  PAYMENT_SUBMIT: {
    limit: 10,
    window: 24 * 60 * 60,
    message: "Too many payment attempts. Please try again tomorrow.",
  },

  // API calls per user (per minute)
  API_CALL: {
    limit: 60,
    window: 60,
    message: "Rate limit exceeded. Max 60 requests per minute.",
  },
};

// ============================================
// RATE LIMIT CHECK
// ============================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  message?: string;
}

/**
 * Check if a request should be rate-limited
 * Returns: { allowed, remaining, resetAt, message? }
 */
export async function checkRateLimit(
  env: CloudflareEnv,
  identifier: string, // borrower_id or IP address
  action: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const key = `rate-limit:${action}:${identifier}`;

  try {
    // Get current count
    const current = (await cacheGet(env, key)) || 0;

    if (current >= config.limit) {
      // Rate limit exceeded
      const resetAt = Date.now() + config.window * 1000;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        message: config.message,
      };
    }

    // Increment and return remaining
    const next = current + 1;
    await cacheSet(env, key, next, config.window);

    const resetAt = Date.now() + config.window * 1000;
    return {
      allowed: true,
      remaining: config.limit - next,
      resetAt,
    };
  } catch (error) {
    console.error(`[RATE_LIMIT] Error checking ${action}:`, error);
    // Fail open — allow request on cache error
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: Date.now() + config.window * 1000,
    };
  }
}

// ============================================
// FRAUD DETECTION
// ============================================

export interface FraudCheck {
  isFraud: boolean;
  riskScore: number; // 0-100
  signals: string[];
}

/**
 * Check for suspicious behavior (fraud detection)
 */
export async function checkFraudSignals(
  env: CloudflareEnv,
  borrowerId: string,
  action: "application" | "payment"
): Promise<FraudCheck> {
  const signals: string[] = [];
  let riskScore = 0;

  // Signal 1: Too many applications in short time
  if (action === "application") {
    const appCount = (await cacheGet(env, `fraud:${borrowerId}:app_count`)) || 0;
    if (appCount > 3) {
      signals.push("Excessive applications");
      riskScore += 25;
    }
  }

  // Signal 2: Too many payments in short time
  if (action === "payment") {
    const payCount = (await cacheGet(env, `fraud:${borrowerId}:pay_count`)) || 0;
    if (payCount > 5) {
      signals.push("Excessive payments");
      riskScore += 20;
    }
  }

  // Signal 3: Recent account creation
  // (would check created_at in database)

  // Signal 4: Unusual IP location
  // (would use GeoIP data from Cloudflare)

  // Signal 5: Mismatched data (checked during document verification)
  const cachedFraudScore = await cacheGet(env, `fraud:${borrowerId}:score`);
  if (cachedFraudScore && cachedFraudScore > 70) {
    signals.push("High fraud score from documents");
    riskScore += cachedFraudScore * 0.3;
  }

  return {
    isFraud: riskScore > 70,
    riskScore: Math.min(100, riskScore),
    signals,
  };
}

// ============================================
// MIDDLEWARE WRAPPER
// ============================================

/**
 * Middleware function to attach to request handlers
 * Usage: if (!await enforceRateLimit(...)) return errorResponse(429);
 */
export async function enforceRateLimit(
  env: CloudflareEnv,
  borrowerId: string,
  action: keyof typeof RATE_LIMITS
): Promise<{ allowed: boolean; headers: Record<string, string> }> {
  const result = await checkRateLimit(env, borrowerId, action);
  const config = RATE_LIMITS[action];

  const headers = {
    "X-RateLimit-Limit": String(config.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  };

  return {
    allowed: result.allowed,
    headers,
  };
}
