import { runApi, type PagesFunctionContext } from './_shared/api.ts';

/** Handles /loans list endpoint. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
