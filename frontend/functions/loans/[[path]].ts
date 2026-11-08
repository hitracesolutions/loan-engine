import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles /loans/:id, /loans/:id/schedule, /loans/:id/transactions, /loans/:id/outstanding, /loans/:id/payments. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
