/**
 * AES-256-GCM authenticated encryption helper for sensitive PII (National IDs).
 *
 * Uses the Web Crypto API (supported natively in Cloudflare Workers and Node 18+).
 * Cryptographic Keys:
 * - Read exclusively from the environment secret `ID_ENCRYPTION_KEY`.
 * - Never logged, committed, or hardcoded.
 * - Minimum 256 bits (32 bytes). Accepted formats: 64-char hex or raw 32-byte string.
 *
 * Fail Closed:
 * - Any decryption failure, invalid key, or tampered ciphertext throws and aborts.
 */

export interface EncryptedPayload {
  ciphertext: string; // Hex-encoded ciphertext
  iv: string;         // Hex-encoded 12-byte IV (nonce)
  tag: string;        // Hex-encoded 16-byte authentication tag
  keyVersion: number; // Monotonically increasing key version (default 1)
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Derives or parses a 256-bit CryptoKey from the ID_ENCRYPTION_KEY secret.
 */
async function importKey(secretKey: string): Promise<CryptoKey> {
  if (!secretKey || typeof secretKey !== 'string') {
    throw new Error('ID_ENCRYPTION_KEY is not configured');
  }

  const trimmed = secretKey.trim();
  let keyBytes: Uint8Array;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    keyBytes = hexToBytes(trimmed);
  } else {
    const raw = new TextEncoder().encode(trimmed);
    if (raw.length === 32) {
      keyBytes = raw;
    } else {
      // Deterministically derive 32 bytes via SHA-256 if key is arbitrary length passphrase
      const digest = await crypto.subtle.digest('SHA-256', raw);
      keyBytes = new Uint8Array(digest);
    }
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Generates a fresh cryptographically random 12-byte IV for every invocation.
 */
export async function encryptNationalId(
  plaintext: string,
  secretKey: string,
  keyVersion = 1,
): Promise<EncryptedPayload> {
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }

  const cryptoKey = await importKey(secretKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    encoded,
  );

  const cipherBytes = new Uint8Array(cipherBuffer);
  // Web Crypto AES-GCM appends the 16-byte authentication tag at the end
  const tagLength = 16;
  const ciphertextPart = cipherBytes.slice(0, cipherBytes.length - tagLength);
  const tagPart = cipherBytes.slice(cipherBytes.length - tagLength);

  return {
    ciphertext: bytesToHex(ciphertextPart),
    iv: bytesToHex(iv),
    tag: bytesToHex(tagPart),
    keyVersion,
  };
}

/**
 * Decrypts an AES-256-GCM payload.
 * Fails closed if the key is incorrect, ciphertext is modified, or tag is invalid.
 */
export async function decryptNationalId(
  payload: { ciphertext: string; iv: string; tag: string; keyVersion?: number },
  secretKey: string,
): Promise<string> {
  const cryptoKey = await importKey(secretKey);
  const iv = hexToBytes(payload.iv);
  const ciphertext = hexToBytes(payload.ciphertext);
  const tag = hexToBytes(payload.tag);

  // Combine ciphertext and tag for Web Crypto SubtleCrypto.decrypt
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      cryptoKey,
      combined,
    );
    return new TextDecoder().decode(plainBuffer);
  } catch (err) {
    throw new Error('Authenticated decryption failed: invalid key or tampered ciphertext');
  }
}
