import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles /payments/:id/reverse. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
