import type { Env } from './types';

export function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = env.CORS_ORIGINS.split(',').map((s) => s.trim());
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0]!;
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-debug-token',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

export function preflight(env: Env, request: Request): Response {
  const origin = request.headers.get('origin');
  return new Response(null, { status: 204, headers: corsHeaders(env, origin) });
}

export function withCors(env: Env, request: Request, response: Response): Response {
  const origin = request.headers.get('origin');
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(env, origin))) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
