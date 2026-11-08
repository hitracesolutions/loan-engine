import { runApi, type PagesFunctionContext } from './_shared/api.ts';

/** Handles /lenders collection endpoints. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
