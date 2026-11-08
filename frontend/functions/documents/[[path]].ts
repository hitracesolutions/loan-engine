import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles nested /documents routes. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
