import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles /outbox/process. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
