import type { GenerateReq } from '@hero-syndrome/shared';
import { preflight, withCors } from './cors';
import { getCosmic } from './cosmic';
import { rotateDailyVocab } from './cosmic/dailyRotation';
import { reverseGeocode } from './geocode';
import { readEpisode } from './kv';
import { logRequest } from './logger';
import { nearbyPois } from './nearby';
import { episodeSongKey, preludeKey, preludeManifestKey, sessionSongKey, streamObject } from './r2';
import { SessionDO } from './sessionDO';
import { QuantumDO } from './quantumDO';
import type { Env } from './types';
import { getWeather } from './weather';
import { COSMIC_VOCAB_META } from './cosmic/cosmicWord';

export { SessionDO, QuantumDO };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const start = Date.now();
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    let status = 500;
    let sessionIdForLog: string | undefined;

    try {
      if (request.method === 'OPTIONS') {
        const res = preflight(env, request);
        status = res.status;
        return res;
      }
      const res = await routeRequest(request, env, ctx, (sid) => {
        sessionIdForLog = sid;
      });
      status = res.status;
      return withCors(env, request, res);
    } catch (err) {
      status = 500;
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'error', err: String(err) }));
      return withCors(env, request, new Response('internal error', { status: 500 }));
    } finally {
      logRequest({
        ts: new Date().toISOString(),
        ...(sessionIdForLog ? { sessionId: sessionIdForLog } : {}),
        route,
        status,
        latencyMs: Date.now() - start,
      });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;
    if (cron === '*/2 * * * *') {
      const id = env.QUANTUM_DO.idFromName('reservoir');
      const stub = env.QUANTUM_DO.get(id);
      ctx.waitUntil(stub.fetch('https://quantum/refill', { method: 'POST' }).then(() => undefined));
      return;
    }
    if (cron === '0 0 * * *') {
      const result = await rotateDailyVocab(env);
      console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'cron.dailyRotation', result }));
      return;
    }
  },
};

async function routeRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  setSessionId: (s: string) => void,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // /api prefix is allowed for the Vite dev proxy convention but optional
  const norm = path.startsWith('/api/') ? path.slice(4) : path;

  // POST /generate                     -> SessionDO
  if (request.method === 'POST' && norm === '/generate') {
    const body = (await request.clone().json()) as GenerateReq;
    if (!body?.sessionId) return new Response('missing sessionId', { status: 400 });
    setSessionId(body.sessionId);
    const id = env.SESSION_DO.idFromName(body.sessionId);
    const stub = env.SESSION_DO.get(id);
    return stub.fetch(`https://session/generate?sessionId=${encodeURIComponent(body.sessionId)}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  }

  // POST /episode/:sessionId/finalize  -> SessionDO
  let m = norm.match(/^\/episode\/([^/]+)\/finalize$/);
  if (request.method === 'POST' && m) {
    const sessionId = m[1]!;
    setSessionId(sessionId);
    const id = env.SESSION_DO.idFromName(sessionId);
    const stub = env.SESSION_DO.get(id);
    const body = await request.text();
    return stub.fetch(`https://session/finalize?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
    });
  }

  // POST /session/:sessionId/sticker
  m = norm.match(/^\/session\/([^/]+)\/sticker$/);
  if (request.method === 'POST' && m) {
    const sessionId = m[1]!;
    setSessionId(sessionId);
    const id = env.SESSION_DO.idFromName(sessionId);
    const stub = env.SESSION_DO.get(id);
    return stub.fetch(`https://session/sticker?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: await request.text(),
      headers: { 'content-type': 'application/json' },
    });
  }

  // POST /session/:sessionId/measured
  m = norm.match(/^\/session\/([^/]+)\/measured$/);
  if (request.method === 'POST' && m) {
    const sessionId = m[1]!;
    setSessionId(sessionId);
    const id = env.SESSION_DO.idFromName(sessionId);
    const stub = env.SESSION_DO.get(id);
    return stub.fetch(`https://session/measured?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: await request.text(),
      headers: { 'content-type': 'application/json' },
    });
  }

  // GET /session/:sessionId/cosmic
  m = norm.match(/^\/session\/([^/]+)\/cosmic$/);
  if (request.method === 'GET' && m) {
    const sessionId = m[1]!;
    setSessionId(sessionId);
    const id = env.SESSION_DO.idFromName(sessionId);
    const stub = env.SESSION_DO.get(id);
    return stub.fetch(`https://session/cosmic?sessionId=${encodeURIComponent(sessionId)}`);
  }

  // GET /episode/:id
  m = norm.match(/^\/episode\/([^/]+)$/);
  if (request.method === 'GET' && m) {
    const episodeId = m[1]!;
    const ep = await readEpisode(env, episodeId);
    if (!ep) return new Response('not found', { status: 404 });
    return Response.json(ep, {
      headers: { 'cache-control': 'public, max-age=3600' },
    });
  }

  // GET /episode/:id/song/:songId
  m = norm.match(/^\/episode\/([^/]+)\/song\/([^/]+)$/);
  if (request.method === 'GET' && m) {
    return streamObject(env, episodeSongKey(m[1]!, m[2]!));
  }

  // GET /song/:sessionId/:songId  (live session)
  m = norm.match(/^\/song\/([^/]+)\/([^/]+)$/);
  if (request.method === 'GET' && m) {
    return streamObject(env, sessionSongKey(m[1]!, m[2]!));
  }

  // GET /preludes/manifest.json
  if (request.method === 'GET' && norm === '/preludes/manifest.json') {
    const obj = await env.AUDIO.get(preludeManifestKey());
    if (!obj) return Response.json({ version: 'empty', preludes: [] });
    return new Response(obj.body, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600',
      },
    });
  }

  // GET /preludes/:id.mp3
  m = norm.match(/^\/preludes\/([^/.]+)\.mp3$/);
  if (request.method === 'GET' && m) {
    return streamObject(env, preludeKey(m[1]!));
  }

  // GET /weather?lat&lon
  if (request.method === 'GET' && norm === '/weather') {
    const lat = parseFloat(url.searchParams.get('lat') ?? '');
    const lon = parseFloat(url.searchParams.get('lon') ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lon)) return new Response('bad coords', { status: 400 });
    try {
      const out = await getWeather(env, lat, lon);
      return Response.json(out);
    } catch (err) {
      return new Response(`weather upstream error: ${String(err)}`, { status: 502 });
    }
  }

  // GET /geocode?lat&lon
  if (request.method === 'GET' && norm === '/geocode') {
    const lat = parseFloat(url.searchParams.get('lat') ?? '');
    const lon = parseFloat(url.searchParams.get('lon') ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lon)) return new Response('bad coords', { status: 400 });
    try {
      const out = await reverseGeocode(env, lat, lon);
      return Response.json(out);
    } catch (err) {
      return new Response(`geocode upstream error: ${String(err)}`, { status: 502 });
    }
  }

  // GET /nearby?lat&lon
  if (request.method === 'GET' && norm === '/nearby') {
    const lat = parseFloat(url.searchParams.get('lat') ?? '');
    const lon = parseFloat(url.searchParams.get('lon') ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lon)) return new Response('bad coords', { status: 400 });
    const out = await nearbyPois(env, lat, lon);
    return Response.json(out);
  }

  // GET /cosmic
  if (request.method === 'GET' && norm === '/cosmic') {
    const out = await getCosmic(env);
    return Response.json(out);
  }

  // GET /debug/session/:sessionId
  m = norm.match(/^\/debug\/session\/([^/]+)$/);
  if (request.method === 'GET' && m) {
    const sessionId = m[1]!;
    const id = env.SESSION_DO.idFromName(sessionId);
    const stub = env.SESSION_DO.get(id);
    return stub.fetch(`https://session/debug?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: { 'x-debug-token': request.headers.get('x-debug-token') ?? '' },
    });
  }

  // GET /admin/session/:sessionId — full DO state (gated by DEV_TOKEN)
  m = norm.match(/^\/admin\/session\/([^/]+)$/);
  if (request.method === 'GET' && m) {
    if (request.headers.get('x-debug-token') !== env.DEV_TOKEN) {
      return new Response('unauthorized', { status: 401 });
    }
    const sessionId = m[1]!;
    const id = env.SESSION_DO.idFromName(sessionId);
    const stub = env.SESSION_DO.get(id);
    return stub.fetch(`https://session/state?sessionId=${encodeURIComponent(sessionId)}`);
  }

  // GET /admin/cosmic-meta -- exposes the loaded vocab metadata for sanity checks
  if (request.method === 'GET' && norm === '/admin/cosmic-meta') {
    return Response.json(COSMIC_VOCAB_META);
  }

  // GET /admin/health
  if (request.method === 'GET' && norm === '/admin/health') {
    return Response.json({ ok: true, ts: new Date().toISOString() });
  }

  // POST /admin/embed (gated by DEV_TOKEN; used by cosmic-vocab-gen CLI)
  if (request.method === 'POST' && norm === '/admin/embed') {
    if (request.headers.get('x-debug-token') !== env.DEV_TOKEN) {
      return new Response('unauthorized', { status: 401 });
    }
    const body = (await request.json()) as { texts: string[] };
    if (!Array.isArray(body?.texts)) return new Response('bad body', { status: 400 });
    const ai: any = env.AI;
    const result = await ai.run('@cf/baai/bge-small-en-v1.5', { text: body.texts });
    const data = (result?.data ?? result?.embeddings ?? result) as number[][];
    return Response.json({ embeddings: data });
  }

  // POST /admin/rotate (gated by DEV_TOKEN; on-demand vocabulary rotation)
  if (request.method === 'POST' && norm === '/admin/rotate') {
    if (request.headers.get('x-debug-token') !== env.DEV_TOKEN) {
      return new Response('unauthorized', { status: 401 });
    }
    const { rotateDailyVocab } = await import('./cosmic/dailyRotation');
    const result = await rotateDailyVocab(env);
    return Response.json(result);
  }

  return new Response('not found', { status: 404 });
}
