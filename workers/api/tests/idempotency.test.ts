import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  newIdempotencyKey,
  assertKeyScope,
  findIdempotentResponse,
} from '../src/lib/idempotency.ts';

describe('idempotency keys', () => {
  it('generates unique 26-char ULID idempotency keys', () => {
    const k1 = newIdempotencyKey();
    const k2 = newIdempotencyKey();
    assert.equal(k1.length, 26);
    assert.equal(k2.length, 26);
    assert.notEqual(k1, k2);
  });

  it('assertKeyScope rejects key reuse for a different operation scope with 409', async () => {
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async <T>() => ({ scope: 'applications.create' } as unknown as T),
        }),
      }),
    } as unknown as D1Database;

    await assert.rejects(
      async () => assertKeyScope(mockDb, 'agency_default', 'key_123', 'disbursements.execute'),
      (err: any) => err.status === 409 && err.code === 'IDEMPOTENCY_KEY_REUSED',
    );
  });

  it('assertKeyScope allows key match for the same scope', async () => {
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async <T>() => ({ scope: 'applications.create' } as unknown as T),
        }),
      }),
    } as unknown as D1Database;

    const exists = await assertKeyScope(mockDb, 'agency_default', 'key_123', 'applications.create');
    assert.equal(exists, true);
  });

  it('findIdempotentResponse returns replayed payload for existing key', async () => {
    const cachedData = { id: 'app_123', status: 'SUBMITTED', requestedAmountPesewas: 500000 };
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async <T>() => ({ response_body: JSON.stringify(cachedData) } as unknown as T),
        }),
      }),
    } as unknown as D1Database;

    const result = await findIdempotentResponse(mockDb, 'agency_default', 'key_123');
    assert.deepEqual(result, cachedData);
  });

  it('findIdempotentResponse returns undefined for null or unused key', async () => {
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async <T>() => null as unknown as T,
        }),
      }),
    } as unknown as D1Database;

    const res1 = await findIdempotentResponse(mockDb, 'agency_default', null);
    assert.equal(res1, undefined);

    const res2 = await findIdempotentResponse(mockDb, 'agency_default', 'unused_key');
    assert.equal(res2, undefined);
  });
});
