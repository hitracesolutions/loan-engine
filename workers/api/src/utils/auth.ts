/**
 * Auth Utilities — JWT verification and token generation
 */

import { SignJWT, jwtVerify } from "jose";
import type { CloudflareEnv } from "../types";

interface JWTPayload {
  sub: string; // user ID
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Create a JWT token
 */
export async function createToken(
  payload: Omit<JWTPayload, "iat" | "exp">,
  env: CloudflareEnv,
  expiresIn = "7d"
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);

  return token;
}

/**
 * Verify a JWT token
 */
export async function verifyToken(
  token: string,
  env: CloudflareEnv
): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const verified = await jwtVerify(token, secret);
    return verified.payload as JWTPayload;
  } catch (error) {
    console.error("[AUTH] Token verification failed:", error);
    return null;
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Verify request has valid token
 */
export async function requireAuth(
  request: Request,
  env: CloudflareEnv
): Promise<JWTPayload | null> {
  const token = extractToken(request);
  if (!token) return null;

  return verifyToken(token, env);
}

/**
 * Hash password (basic example — use bcrypt in production)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
