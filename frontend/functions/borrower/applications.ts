import { runApi, type PagesFunctionContext } from '../_shared/api.ts';

export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return runApi(context);
}
