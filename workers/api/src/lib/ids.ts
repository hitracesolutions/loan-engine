/**
 * ULID generation — lexicographically sortable, 26-char Crockford base32 ids.
 * Structure: 48-bit timestamp (10 chars) + 80 bits of randomness (16 chars).
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number): string {
  let remaining = now;
  let out = '';
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = remaining % ENCODING_LEN;
    out = ENCODING[mod] + out;
    remaining = (remaining - mod) / ENCODING_LEN;
  }
  return out;
}

function encodeRandom(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LEN));
  let out = '';
  for (const byte of bytes) {
    out += ENCODING[byte % ENCODING_LEN];
  }
  return out;
}

export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}
