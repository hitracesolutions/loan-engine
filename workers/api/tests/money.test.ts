import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cediToPesewas, formatCedis, percentToBps, splitPesewas } from '../src/lib/money.ts';
import { ulid } from '../src/lib/ids.ts';

describe('money', () => {
  it('converts cedis to pesewas without float drift', () => {
    assert.equal(cediToPesewas(19.99), 1999);
    assert.equal(cediToPesewas(0.1 + 0.2), 30);
    assert.equal(cediToPesewas(50000), 5_000_000);
  });

  it('formats pesewas as two-decimal cedis', () => {
    assert.equal(formatCedis(5_000_000), '50000.00');
    assert.equal(formatCedis(1999), '19.99');
    assert.equal(formatCedis(0), '0.00');
  });

  it('converts percentages to basis points', () => {
    assert.equal(percentToBps(21), 2100);
    assert.equal(percentToBps(18.5), 1850);
  });

  it('splits an amount so the parts sum exactly to the total', () => {
    for (const total of [0, 1, 100, 1_008_33, 5_000_001]) {
      for (const parts of [1, 3, 12, 36]) {
        const split = splitPesewas(total, parts);
        assert.equal(split.length, parts);
        assert.equal(split.reduce((a, b) => a + b, 0), total);
        assert.ok(split.every((part) => Number.isSafeInteger(part)));
      }
    }
  });

  it('rejects invalid inputs', () => {
    assert.throws(() => splitPesewas(-1, 12), RangeError);
    assert.throws(() => splitPesewas(100, 0), RangeError);
  });
});

describe('ulid', () => {
  it('produces 26-char sortable ids with a stable prefix for the same millisecond', () => {
    const now = 1_763_000_000_000;
    const a = ulid(now);
    const b = ulid(now);
    assert.equal(a.length, 26);
    assert.equal(a.slice(0, 10), b.slice(0, 10));
    assert.notEqual(a, b);
  });

  it('increases lexicographically over time', () => {
    assert.ok(ulid(1_763_000_000_000) < ulid(1_763_000_000_001));
  });
});
