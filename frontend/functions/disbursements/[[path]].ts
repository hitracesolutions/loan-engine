import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles /disbursements/prepare and /disbursements/confirm. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
