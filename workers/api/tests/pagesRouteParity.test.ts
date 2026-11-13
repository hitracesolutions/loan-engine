import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { onRequest as loansListHandler } from '../../../frontend/functions/loans.ts';
import { onRequest as loansNestedHandler } from '../../../frontend/functions/loans/[[path]].ts';
import { onRequest as lendersListHandler } from '../../../frontend/functions/lenders.ts';
import { onRequest as lendersNestedHandler } from '../../../frontend/functions/lenders/[[path]].ts';
import { onRequest as lenderProposalsHandler } from '../../../frontend/functions/lender/[[path]].ts';
import { onRequest as disbursementsListHandler } from '../../../frontend/functions/disbursements.ts';
import { onRequest as disbursementsNestedHandler } from '../../../frontend/functions/disbursements/[[path]].ts';
import { onRequest as paymentsNestedHandler } from '../../../frontend/functions/payments/[[path]].ts';
import { onRequest as ledgerNestedHandler } from '../../../frontend/functions/ledger/[[path]].ts';
import { onRequest as documentsListHandler } from '../../../frontend/functions/documents.ts';
import { onRequest as outboxListHandler } from '../../../frontend/functions/outbox.ts';
import { onRequest as outboxNestedHandler } from '../../../frontend/functions/outbox/[[path]].ts';
import { onRequest as auditNestedHandler } from '../../../frontend/functions/audit/[[path]].ts';
import type { AppEnv } from '../src/env.ts';

const mockEnv: AppEnv = {
  DB: {} as unknown as D1Database,
  APP_NAME: 'Gidfine',
  APP_ENV: 'test',
  ALLOWED_ORIGINS: 'https://lending.gidfine.com,http://localhost:5173',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  JWT_SIGNING_KEY: 'test_jwt_secret_32_characters_long_min_len',
};

describe('S-01: Pages Functions Route Parity Audit', () => {
  it('confirms all required Pages Functions route files exist in frontend/functions', () => {
    const functionsDir = path.resolve(process.cwd(), '../../frontend/functions');
    const requiredFiles = [
      'loans.ts',
      'loans/[[path]].ts',
      'lenders.ts',
      'lenders/[[path]].ts',
      'lender/[[path]].ts',
      'disbursements.ts',
      'disbursements/[[path]].ts',
      'payments/[[path]].ts',
      'ledger/[[path]].ts',
      'documents.ts',
      'documents/[[path]].ts',
      'outbox.ts',
      'outbox/[[path]].ts',
      'audit/[[path]].ts',
      'borrower/applications/[[path]].ts',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(functionsDir, file);
      assert.ok(fs.existsSync(filePath), `Required Pages Function file missing: ${file}`);
    }
  });

  describe('Loans Servicing Route Parity (/loans/**)', () => {
    it('routes GET /loans via loans.ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/loans', { method: 'GET' });
      const res = await loansListHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /loans/:id via loans/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/loans/loan_123', { method: 'GET' });
      const res = await loansNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /loans/:id/schedule via loans/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/loans/loan_123/schedule', { method: 'GET' });
      const res = await loansNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /loans/:id/transactions via loans/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/loans/loan_123/transactions', { method: 'GET' });
      const res = await loansNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /loans/:id/outstanding via loans/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/loans/loan_123/outstanding', { method: 'GET' });
      const res = await loansNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes POST /loans/:id/payments via loans/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/loans/loan_123/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPesewas: 10000, paymentMethod: 'CASH', reference: 'REF' }),
      });
      const res = await loansNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });
  });

  describe('Financial Ledger & Operations Route Parity', () => {
    it('routes GET /disbursements via disbursements.ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/disbursements', { method: 'GET' });
      const res = await disbursementsListHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes POST /disbursements/prepare via disbursements/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/disbursements/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: 'app_1', channel: 'MOMO', destinationAccountMasked: '****' }),
      });
      const res = await disbursementsNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes POST /disbursements/confirm via disbursements/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/disbursements/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disbursementId: 'disb_1' }),
      });
      const res = await disbursementsNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /ledger/entries via ledger/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/ledger/entries', { method: 'GET' });
      const res = await ledgerNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes POST /payments/:id/reverse via payments/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/payments/pay_123/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Accidental double payment' }),
      });
      const res = await paymentsNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /lender/proposals via lender/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/lender/proposals', { method: 'GET' });
      const res = await lenderProposalsHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /lenders via lenders.ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/lenders', { method: 'GET' });
      const res = await lendersListHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /lenders/:id/products via lenders/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/lenders/lender_1/products', { method: 'GET' });
      const res = await lendersNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /documents via documents.ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/documents', { method: 'GET' });
      const res = await documentsListHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /outbox via outbox.ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/outbox', { method: 'GET' });
      const res = await outboxListHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes POST /outbox/process via outbox/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/outbox/process', { method: 'POST' });
      const res = await outboxNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });

    it('routes GET /audit/security via audit/[[path]].ts and returns 401 (not 404)', async () => {
      const req = new Request('https://lending.gidfine.com/audit/security', { method: 'GET' });
      const res = await auditNestedHandler({ request: req, env: mockEnv });
      assert.equal(res.status, 401);
      const json = await res.json() as any;
      assert.equal(json.ok, false);
      assert.equal(json.error.code, 'UNAUTHENTICATED');
    });
  });
});
