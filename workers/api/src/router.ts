import type { AppEnv } from './env.ts';
import { notFound } from './lib/http.ts';

export interface RouteContext {
  request: Request;
  env: AppEnv;
  url: URL;
  params: Record<string, string>;
  requestId: string;
}

export type RouteHandler = (ctx: RouteContext) => Promise<Response>;

interface Route {
  method: string;
  segments: string[];
  handler: RouteHandler;
}

export class Router {
  private readonly routes: Route[] = [];

  add(method: string, pattern: string, handler: RouteHandler): this {
    this.routes.push({
      method: method.toUpperCase(),
      segments: pattern.split('/').filter(Boolean),
      handler,
    });
    return this;
  }

  get(pattern: string, handler: RouteHandler): this {
    return this.add('GET', pattern, handler);
  }

  post(pattern: string, handler: RouteHandler): this {
    return this.add('POST', pattern, handler);
  }

  /** Returns the handler and captured path params, or throws 404. */
  match(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } {
    const pathSegments = pathname.split('/').filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== pathSegments.length) continue;

      const params: Record<string, string> = {};
      let matched = true;

      for (let i = 0; i < route.segments.length; i++) {
        const expected = route.segments[i] as string;
        const actual = pathSegments[i] as string;

        if (expected.startsWith(':')) {
          params[expected.slice(1)] = decodeURIComponent(actual);
        } else if (expected !== actual) {
          matched = false;
          break;
        }
      }

      if (matched) return { handler: route.handler, params };
    }

    throw notFound(`No route for ${method} ${pathname}`);
  }
}


