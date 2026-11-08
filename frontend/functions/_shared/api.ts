import worker from '../../../workers/api/src/index.ts';
import type { AppEnv } from '../../../workers/api/src/env.ts';

export interface PagesFunctionContext {
  request: Request;
  env: AppEnv;
}

/** Runs the existing Worker router inside a Pages Function. */
export function runApi({ request, env }: PagesFunctionContext): Promise<Response> {
  return worker.fetch(request, env);
}
