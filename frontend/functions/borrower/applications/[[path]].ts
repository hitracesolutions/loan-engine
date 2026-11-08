import { runApi, type PagesFunctionContext } from '../../_shared/api.ts';

/** Handles /borrower/applications/:id/response and nested borrower application routes. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
