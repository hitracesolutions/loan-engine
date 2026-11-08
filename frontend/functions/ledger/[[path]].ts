import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles /ledger/entries and double-entry ledger routes. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
