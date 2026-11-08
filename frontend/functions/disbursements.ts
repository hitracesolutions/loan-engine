import { runApi, type PagesFunctionContext } from './_shared/api.ts';

/** Handles /disbursements list endpoint. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
