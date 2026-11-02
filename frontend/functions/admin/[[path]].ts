import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

/** Handles /admin/users and /admin/impersonate* — administrator impersonation. */
export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
