import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker, { apiRoutes, isApiPath } from '../src/index.ts';
import type { AppEnv } from '../src/env.ts';

/**
 * S-01 — Pages Functions route parity.
 *
 * The deployed site serves the API through a single Pages `_middleware` that
 * forwards every path `isApiPath` recognises to the Worker router. These checks
 * assert that (a) every registered route is covered by that rule, so no route
 * 404s same-origin in production, and (b) protected routes return 401 (auth
 * required), not 404 (no such route).
 */

function createD1Adapter(sqliteDb: DatabaseSync): D1Database {
  function createPreparedStatement(sql: string, params: any[] = []): D1PreparedStatement {
    return {
      bind(...values: any[]) {
        return createPreparedStatement(sql, values);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const row = sqliteDb.prepare(sql).get(...params);
        if (!row) return null;
        if (colName) return (row as any)[colName] ?? null;
        return row as T;
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        const results = sqliteDb.prepare(sql).all(...params) as T[];
        return { results, success: true, meta: {} as any };
      },
      async run(): Promise<D1Response> {
        const res = sqliteDb.prepare(sql).run(...params);
        return { success: true, meta: { changes: res.changes } as any };
      },
      raw<T = unknown>(): Promise<T[]> {
        throw new Error('Not implemented');
      },
    } as unknown as D1PreparedStatement;
  }

  return {
    prepare(query: string): D1PreparedStatement {
      return createPreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      sqliteDb.exec('BEGIN TRANSACTION;');
      try {
        const out = [];
        for (const s of statements) {
          const res = await s.run();
          out.push({ results: [], success: true, meta: res.meta } as any);
        }
        sqliteDb.exec('COMMIT;');
        return out;
      } catch (err) {
        sqliteDb.exec('ROLLBACK;');
        throw err;
      }
    },
    async exec(query: string): Promise<D1ExecResult> {
      sqliteDb.exec(query);
      return { count: 0, duration: 0 };
    },
    dump(): Promise<ArrayBuffer> {
      throw new Error('Not implemented');
    },
  } as unknown as D1Database;
}

describe('S-01 Pages route parity', () => {
  let env: AppEnv;

  beforeEach(() => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    const migrationsDir = path.resolve(import.meta.dirname, '../migrations');
    for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
      sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }
    env = {
      DB: createD1Adapter(sqlite),
      APP_NAME: 'Gidfine',
      APP_ENV: 'development',
      ALLOWED_ORIGINS: 'http://localhost:5173',
      ACCESS_TOKEN_TTL_SECONDS: '900',
      JWT_SIGNING_KEY: 'super-secret-test-key-at-least-32-chars-long!',
      ID_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ADMIN_EMAIL: 'admin@gidfine.com',
      ADMIN_PASSWORD: 'SecureAdminPassword123!',
    } as any;
  });

  it('every registered route is reachable through the Pages middleware', () => {
    assert.ok(apiRoutes.length > 0, 'router exposes its routes');
    for (const route of apiRoutes) {
      assert.equal(
        isApiPath(route.pattern),
        true,
        `${route.method} ${route.pattern} must be forwarded by the Pages middleware`,
      );
    }
    // The nouns that used to 404 same-origin are covered.
    for (const p of ['/lenders', '/lender/proposals', '/disbursements', '/loans', '/payments/x/reverse', '/ledger/entries', '/documents', '/outbox', '/audit/security', '/reports/disbursement-reconciliation']) {
      assert.equal(isApiPath(p), true, `${p} must be an API path`);
    }
  });

  it('SPA and asset paths fall through to the static app', () => {
    for (const p of ['/', '/dashboard', '/docs', '/assets/index-abc.js', '/favicon.ico']) {
      assert.equal(isApiPath(p), false, `${p} must NOT be treated as an API path`);
    }
  });

  it('protected routes return 401 (auth required), not 404 (no route)', async () => {
    for (const p of ['/lenders', '/loans']) {
      const res = await worker.fetch(new Request(`http://localhost${p}`), env);
      assert.equal(res.status, 401, `GET ${p} without auth should be 401, got ${res.status}`);
    }
  });
});
