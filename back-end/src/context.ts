// Per-request context. Collects HTTP-layer data (request, env, url, route
// params, authenticated user id) so it doesn't have to be drilled through
// every function. Lives only in the route/controller layer; services receive
// plain arguments instead.

export interface Ctx {
  request: Request;
  env: Env;
  url: URL;
  method: string;
  /** Route params parsed from the path, e.g. { id } / { bookId }. */
  params: Record<string, string>;
  /** Authenticated user id, set by checkAuth after token verification. */
  userId: number;
  /** Lazily parse and cache the JSON request body. */
  json<T>(): Promise<T>;
}

/** Build a Ctx for an incoming request. */
export function createContext(request: Request, env: Env): Ctx {
  const url = new URL(request.url);
  let bodyPromise: Promise<unknown> | undefined;

  return {
    request,
    env,
    url,
    method: request.method,
    params: {},
    userId: 0,
    json<T>(): Promise<T> {
      if (!bodyPromise) {
        bodyPromise = request.json();
      }
      return bodyPromise as Promise<T>;
    },
  };
}
