import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles /audit/security and security audit routes. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
