import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  requireActor,
} from '../src/lib/auth.ts';

const TEST_JWT_SECRET = 'test_secret_key_minimum_32_characters_long_for_hmac';

describe('password hashing', () => {
  it('verifies the correct password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    assert.equal(await verifyPassword('correct horse battery staple', stored), true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    assert.equal(await verifyPassword('correct horse battery stapl', stored), false);
  });

  it('never stores the password in plain text', async () => {
    const stored = await hashPassword('correct horse battery staple');
    assert.ok(!stored.includes('correct horse'));
    assert.match(stored, /^pbkdf2-sha256\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('salts each hash independently', async () => {
    const a = await hashPassword('same password');
    const b = await hashPassword('same password');
    assert.notEqual(a, b);
  });

  it('rejects malformed stored hashes', async () => {
    assert.equal(await verifyPassword('x', 'not-a-hash'), false);
    assert.equal(await verifyPassword('x', 'pbkdf2-sha256$0$c2FsdA==$aGFzaA=='), false);
  });
});

describe('jwt access tokens & 401 handling', () => {
  it('signs and verifies valid access tokens', async () => {
    const token = await signAccessToken(
      { userId: 'usr_123', agencyId: 'agency_default', role: 'borrower' },
      TEST_JWT_SECRET,
      3600,
    );
    const claims = await verifyAccessToken(token, TEST_JWT_SECRET);
    assert.equal(claims.sub, 'usr_123');
    assert.equal(claims.agencyId, 'agency_default');
    assert.equal(claims.role, 'borrower');
  });

  it('rejects expired tokens with 401', async () => {
    const expiredToken = await signAccessToken(
      { userId: 'usr_123', agencyId: 'agency_default', role: 'borrower' },
      TEST_JWT_SECRET,
      -10, // expired 10 seconds ago
    );
    await assert.rejects(
      async () => verifyAccessToken(expiredToken, TEST_JWT_SECRET),
      (err: any) => err.status === 401 && err.message.includes('Invalid or expired token'),
    );
  });

  it('rejects tampered signatures with 401', async () => {
    const token = await signAccessToken(
      { userId: 'usr_123', agencyId: 'agency_default', role: 'borrower' },
      TEST_JWT_SECRET,
      3600,
    );
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.tamperedSignature`;
    await assert.rejects(
      async () => verifyAccessToken(tampered, TEST_JWT_SECRET),
      (err: any) => err.status === 401,
    );
  });

  it('rejects malformed tokens with 401', async () => {
    await assert.rejects(
      async () => verifyAccessToken('not.a.token.with.five.parts', TEST_JWT_SECRET),
      (err: any) => err.status === 401,
    );
    await assert.rejects(
      async () => verifyAccessToken('incomplete', TEST_JWT_SECRET),
      (err: any) => err.status === 401,
    );
  });

  it('requireActor extracts claims from valid Bearer header', async () => {
    const token = await signAccessToken(
      { userId: 'usr_borrower_1', agencyId: 'agency_default', role: 'borrower' },
      TEST_JWT_SECRET,
      3600,
    );
    const req = new Request('https://api.gidfine.test/applications', {
      headers: { authorization: `Bearer ${token}` },
    });
    const actor = await requireActor(req, TEST_JWT_SECRET);
    assert.equal(actor.userId, 'usr_borrower_1');
    assert.equal(actor.agencyId, 'agency_default');
    assert.equal(actor.role, 'borrower');
  });

  it('requireActor throws 401 for missing or non-Bearer authorization', async () => {
    const req1 = new Request('https://api.gidfine.test/applications');
    await assert.rejects(
      async () => requireActor(req1, TEST_JWT_SECRET),
      (err: any) => err.status === 401 && err.message.includes('Missing bearer token'),
    );

    const req2 = new Request('https://api.gidfine.test/applications', {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    await assert.rejects(
      async () => requireActor(req2, TEST_JWT_SECRET),
      (err: any) => err.status === 401,
    );
  });
});
