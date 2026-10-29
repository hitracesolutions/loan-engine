import { runApi, type PagesFunctionContext } from '../../_shared/api.ts';

/** Handles /applications and nested review workflow routes. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
