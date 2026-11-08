import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles /lenders/:id/products and nested lender routes. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
