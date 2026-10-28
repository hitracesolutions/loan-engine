/**
 * Identity primitives: PBKDF2 password hashing and HS256 access tokens.
 *
 * Both run on Web Crypto so the same code can be bundled by a Worker or by
 * Pages Functions without a Node-only JWT dependency.
 */

import { unauthorized } from './http.ts';
import type { UserRole } from '../domain/stateMachine.ts';
import type { AppEnv } from '../env.ts';

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

/** Creates the configured local/platform admin in the current users table once. */
export async function ensureAdminUser(env: AppEnv): Promise<void> {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const agency = await env.DB
    .prepare('SELECT id FROM agencies WHERE slug = ?')
    .bind('gidfine')
    .first<{ id: string }>();
  if (!agency) return;

  const existing = await env.DB
    .prepare('SELECT id FROM users WHERE agency_id = ? AND lower(email) = ?')
    .bind(agency.id, email)
    .first<{ id: string }>();
  if (existing) return;

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO users
       (id, agency_id, role, email, phone, full_name, password_hash, is_active, created_at, updated_at)
     VALUES (?, ?, 'agency_admin', ?, NULL, 'Platform Admin', ?, 1, ?, ?)`,
  )
    .bind(`admin_${now.toString(36)}`, agency.id, email, await hashPassword(password), now, now)
    .run();
}

export interface AccessTokenClaims {
  sub: string;
  agencyId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

function signingKey(secret: string): Uint8Array {
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SIGNING_KEY is missing or shorter than 32 characters');
  }
  return new TextEncoder().encode(secret);
}

interface JwtHeader {
  alg: string;
  typ: string;
}

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseJwtJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment))) as T;
}

async function signHmac(input: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    signingKey(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return new Uint8Array(signature);
}

export async function signAccessToken(
  claims: { userId: string; agencyId: string; role: UserRole },
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: claims.userId,
      agencyId: claims.agencyId,
      role: claims.role,
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    }),
  );
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${base64UrlEncode(await signHmac(signingInput, secret))}`;
}

/** Verifies a bearer token and returns its claims, or throws 401. */
export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenClaims> {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new Error('Malformed token');
    }

    const header = parseJwtJson<JwtHeader>(encodedHeader);
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new Error('Unsupported token header');
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await signHmac(signingInput, secret);
    if (!timingSafeEqual(base64UrlDecode(encodedSignature), expectedSignature)) {
      throw new Error('Invalid token signature');
    }

    const payload = parseJwtJson<Partial<AccessTokenClaims>>(encodedPayload);
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.agencyId !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.iat) ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= now
    ) {
      throw new Error('Token is missing required claims or has expired');
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
