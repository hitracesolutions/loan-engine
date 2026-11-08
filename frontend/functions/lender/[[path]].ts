import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles /lender/proposals and /lender/proposals/:id/respond. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
