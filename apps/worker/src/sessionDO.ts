import type {
  DescribeReq,
  DescribeRes,
  FinalizeReq,
  GenerateReq,
  GenerateRes,
  MeasuredFeatures,
  SessionRecord,
} from '@hero-syndrome/shared';
import { runDescribe } from './describe';
import { runGenerate } from './generate';
import { finalizeSession } from './episode';
import { getCosmic } from './cosmic';
import type { DebugLogEvent, Env, SessionDoState } from './types';

const RATE_LIMIT_MS = 10_000;
const MAX_SONGS_PER_SESSION = 10;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DEBUG_LOG_CAP = 200;

export class SessionDO {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId') ?? '';
    if (!sessionId) return new Response('missing sessionId', { status: 400 });
    if (url.pathname === '/generate' && request.method === 'POST') {
      return this.handleGenerate(sessionId, request);
    }
    if (url.pathname === '/describe' && request.method === 'POST') {
      return this.handleDescribe(sessionId, request);
    }
    if (url.pathname === '/finalize' && request.method === 'POST') {
      return this.handleFinalize(sessionId, request);
    }
    if (url.pathname === '/measured' && request.method === 'POST') {
      return this.handleMeasured(sessionId, request);
    }
    if (url.pathname === '/cosmic' && request.method === 'GET') {
      return this.handleCosmic(sessionId);
    }
    if (url.pathname === '/debug' && request.method === 'GET') {
      return this.handleDebug(request);
    }
    if (url.pathname === '/state' && request.method === 'GET') {
      const s = await this.loadState(sessionId);
      return Response.json(s ?? null);
    }
    return new Response('not found', { status: 404 });
  }

  private async loadState(sessionId: string): Promise<SessionDoState | null> {
    const s = await this.state.storage.get<SessionDoState>('state');
    if (s) return s;
    const fresh: SessionDoState = {
      sessionId,
      startedAt: new Date().toISOString(),
      songs: [],
      finalized: false,
      debugLog: [],
    };
    return fresh;
  }

  private async saveState(state: SessionDoState): Promise<void> {
    await this.state.storage.put('state', state);
  }

  private async ensureAlarm(): Promise<void> {
    const existing = await this.state.storage.getAlarm();
    if (existing == null) {
      await this.state.storage.setAlarm(Date.now() + SEVEN_DAYS_MS);
    }
  }

  private appendDebug(s: SessionDoState, event: string, payload?: unknown): void {
    const ev: DebugLogEvent = { ts: new Date().toISOString(), event };
    if (payload !== undefined) ev.payload = payload;
    s.debugLog.push(ev);
    if (s.debugLog.length > DEBUG_LOG_CAP) {
      s.debugLog = s.debugLog.slice(-DEBUG_LOG_CAP);
    }
  }

  private async handleGenerate(sessionId: string, request: Request): Promise<Response> {
    let s = await this.loadState(sessionId);
    if (!s) return new Response('no session', { status: 404 });
    if (s.finalized) return new Response('finalized', { status: 409 });
    if (s.songs.length >= MAX_SONGS_PER_SESSION) {
      return new Response('session song limit reached', { status: 429 });
    }

    const now = Date.now();
    if (s.lastGenerateTs && now - s.lastGenerateTs < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - (now - s.lastGenerateTs)) / 1000);
      return new Response('rate limited', {
        status: 429,
        headers: { 'retry-after': String(retryAfter) },
      });
    }
    s.lastGenerateTs = now;

    let perSongCosmic: SessionDoState['cosmic'] | undefined;
    try {
      perSongCosmic = await getCosmic(this.env);
    } catch (err) {
      this.appendDebug(s, 'cosmic.error', String(err));
    }

    if (!s.cosmic && perSongCosmic) {
      s.cosmic = perSongCosmic;
      this.appendDebug(s, 'cosmic.firstFrozen', perSongCosmic);
    }

    const body = (await request.json()) as GenerateReq;
    const lastSong = s.songs[s.songs.length - 1];
    try {
      const result = await runGenerate(
        {
          env: this.env,
          sessionId,
          ...(perSongCosmic ? { cosmic: perSongCosmic } : {}),
          ...(lastSong ? { recentTransitionIntent: lastSong.metadata.transitionIntent } : {}),
        },
        body,
      );
      const r = result.songRecord;
      const songRec = {
        songId: r.songId,
        startedAt: r.startedAt,
        durationSec: r.durationSec,
        metadata: r.metadata,
        composition: r.composition,
        stateVector: r.stateVector,
        quantumBytes: r.quantumBytes,
        ...(r.phraseOfTheMoment ? { phraseOfTheMoment: r.phraseOfTheMoment } : {}),
        ...(r.stacked ? { stacked: r.stacked } : {}),
        ...(r.renderPlan ? { renderPlan: r.renderPlan } : {}),
        ...(r.locationType ? { locationType: r.locationType } : {}),
        ...(r.bodyActivity ? { bodyActivity: r.bodyActivity } : {}),
      };
      s.songs.push(songRec);
      this.appendDebug(s, 'song.append', {
        songId: songRec.songId,
        transition: songRec.metadata.transitionIntent,
        preludeFallback: result.preludeFallback,
        llmLatencyMs: result.llmLatencyMs,
        classifyLocationLatencyMs: result.classifyLocationLatencyMs,
        musicLatencyMs: result.musicLatencyMs,
        locationType: songRec.locationType,
      });
      await this.saveState(s);
      await this.ensureAlarm();
      return Response.json(result.response satisfies GenerateRes);
    } catch (err) {
      const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      const errDetail = (err as any)?.status ? `[${(err as any).status}] ${(err as any)?.body ?? ''}` : '';
      console.error(JSON.stringify({ event: 'generate.error', sessionId, error: errStr, detail: errDetail }));
      this.appendDebug(s, 'generate.error', String(err));
      delete s.lastGenerateTs;
      await this.saveState(s);
      return new Response('generate failed', { status: 503 });
    }
  }

  private async handleDescribe(sessionId: string, request: Request): Promise<Response> {
    const s = await this.loadState(sessionId);
    if (!s) return new Response('no session', { status: 404 });
    const body = (await request.json()) as DescribeReq;
    if (!body?.songId) return new Response('missing songId', { status: 400 });

    const song = s.songs.find((entry) => entry.songId === body.songId);
    if (!song) return new Response('song not found', { status: 404 });

    // Cache: if the song already has a description, return it without
    // re-calling Claude. Cheap idempotent endpoint — clients can retry.
    if (song.title && song.description) {
      return Response.json({
        songId: song.songId,
        title: song.title,
        description: song.description,
      } satisfies DescribeRes);
    }

    try {
      const result = await runDescribe(this.env, song);
      song.title = result.title;
      song.description = result.description;
      this.appendDebug(s, 'song.describe', {
        songId: song.songId,
        latencyMs: result.latencyMs,
      });
      await this.saveState(s);
      return Response.json({
        songId: song.songId,
        title: result.title,
        description: result.description,
      } satisfies DescribeRes);
    } catch (err) {
      const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(JSON.stringify({ event: 'describe.error', sessionId, songId: body.songId, error: errStr }));
      this.appendDebug(s, 'describe.error', String(err));
      await this.saveState(s);
      return new Response('describe failed', { status: 503 });
    }
  }

  private async handleFinalize(sessionId: string, request: Request): Promise<Response> {
    let s = await this.loadState(sessionId);
    if (!s) return new Response('no session', { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Partial<FinalizeReq>;
    if (s.finalized) {
      return new Response('already finalized', { status: 409 });
    }
    s.endedAt = body.endedAt ?? new Date().toISOString();
    s.finalized = true;
    this.appendDebug(s, 'finalize.start');
    try {
      const session: SessionRecord = {
        sessionId: s.sessionId,
        startedAt: s.startedAt,
        ...(s.endedAt ? { endedAt: s.endedAt } : {}),
        ...(s.cosmic ? { cosmic: s.cosmic } : {}),
        songs: s.songs,
      };
      const { result } = await finalizeSession(this.env, session);
      this.appendDebug(s, 'finalize.complete', { episodeId: result.episodeId });
      await this.saveState(s);
      await this.state.storage.setAlarm(Date.now() + 5 * 60 * 1000);
      return Response.json(result);
    } catch (err) {
      this.appendDebug(s, 'finalize.error', String(err));
      s.finalized = false;
      await this.saveState(s);
      return new Response('finalize failed', { status: 500 });
    }
  }

  private async handleMeasured(sessionId: string, request: Request): Promise<Response> {
    const s = await this.loadState(sessionId);
    if (!s) return new Response('no session', { status: 404 });
    const body = (await request.json()) as { songId: string; features: MeasuredFeatures };
    const song = s.songs.find((x) => x.songId === body.songId);
    if (!song) return new Response('song not found', { status: 404 });
    song.measuredFeatures = body.features;
    this.appendDebug(s, 'song.measured', { songId: body.songId, features: body.features });
    await this.saveState(s);
    return Response.json({ ok: true });
  }

  private async handleCosmic(sessionId: string): Promise<Response> {
    let s = await this.loadState(sessionId);
    if (!s) return new Response('no session', { status: 404 });
    if (!s.cosmic) {
      try {
        s.cosmic = await getCosmic(this.env);
      } catch {
        return Response.json({});
      }
      await this.saveState(s);
      await this.ensureAlarm();
    }
    return Response.json(s.cosmic);
  }

  private async handleDebug(request: Request): Promise<Response> {
    const provided = request.headers.get('x-debug-token');
    if (!provided || provided !== this.env.DEV_TOKEN) {
      return new Response('unauthorized', { status: 401 });
    }
    const s = await this.state.storage.get<SessionDoState>('state');
    return Response.json(s?.debugLog ?? []);
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}
