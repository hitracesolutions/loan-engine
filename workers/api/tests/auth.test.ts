import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/lib/auth.ts';

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
