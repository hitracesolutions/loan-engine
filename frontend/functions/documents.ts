import { runApi, type PagesFunctionContext } from './_shared/api.ts';

/** Handles /documents collection endpoint. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
