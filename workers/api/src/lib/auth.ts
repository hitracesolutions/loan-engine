/**
 * Identity primitives: PBKDF2 password hashing and HS256 access tokens.
 *
 * Both run on Web Crypto (via jose for JWT) so there is no Node-only dependency
 * beyond the platform's `crypto` global.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { unauthorized } from './http.ts';
import type { UserRole } from '../domain/stateMachine.ts';

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const HASH_SCHEME = 'pbkdf2-sha256';

export const USER_ROLES = [
  'agency_admin',
  'loan_officer',
  'underwriter',
  'cashier',
  'auditor',
  'lender',
  'borrower',
] as const satisfies readonly UserRole[];

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    material,
    KEY_BITS,
  );

  return new Uint8Array(bits);
}

/** Constant-time comparison so verification does not leak prefix information. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

/** Produces `pbkdf2-sha256$<iterations>$<salt-b64>$<hash-b64>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  return `${HASH_SCHEME}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationsRaw, saltRaw, hashRaw] = stored.split('$');
  if (scheme !== HASH_SCHEME || !iterationsRaw || !saltRaw || !hashRaw) return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isSafeInteger(iterations) || iterations <= 0) return false;

  const expected = fromBase64(hashRaw);
  const actual = await deriveKey(password, fromBase64(saltRaw), iterations);
  return timingSafeEqual(expected, actual);
}

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  agencyId: string;
  role: UserRole;
}

function signingKey(secret: string): Uint8Array {
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SIGNING_KEY is missing or shorter than 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  claims: { userId: string; agencyId: string; role: UserRole },
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({ agencyId: claims.agencyId, role: claims.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(signingKey(secret));
}

/** Verifies a bearer token and returns its claims, or throws 401. */
export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, signingKey(secret), { algorithms: ['HS256'] });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.agencyId !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      throw unauthorized('Token is missing required claims');
    }
    return payload as AccessTokenClaims;
  } catch (error) {
    if (error instanceof Error && error.name === 'HttpError') throw error;
    throw unauthorized('Invalid or expired token');
  }
}

/** Extracts and verifies the access token from an Authorization header. */
export async function requireActor(
  request: Request,
  secret: string,
): Promise<{ userId: string; agencyId: string; role: UserRole }> {
  const header = request.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw unauthorized('Missing bearer token');
  }

  const claims = await verifyAccessToken(token, secret);
  if (!USER_ROLES.includes(claims.role)) {
    throw unauthorized('Token carries an unknown role');
  }

  return { userId: claims.sub, agencyId: claims.agencyId, role: claims.role };
}
