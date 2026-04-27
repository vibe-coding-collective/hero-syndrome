import type { QuantumBytes } from '@hero-syndrome/shared';
import type { Env } from './types';

const ANU_URL = 'https://qrng.anu.edu.au/API/jsonI.php?length=1024&type=uint8';

const HIGH_WATERMARK = 1024;
const LOW_WATERMARK = 256;
const ALARM_PERIOD_MS = 2 * 60 * 1000;

export class QuantumDO {
  private state: DurableObjectState;
  private env: Env;
  private refillInFlight = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/pull' && request.method === 'GET') {
      const n = Math.max(1, Math.min(256, parseInt(url.searchParams.get('n') ?? '16', 10)));
      const result = await this.pull(n);
      return Response.json(result);
    }
    if (url.pathname === '/refill' && request.method === 'POST') {
      const ok = await this.refill();
      return Response.json({ ok });
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      const pool = (await this.state.storage.get<Uint8Array>('pool')) ?? new Uint8Array();
      return Response.json({ length: pool.length, refillInFlight: this.refillInFlight });
    }
    return new Response('not found', { status: 404 });
  }

  private async ensureAlarm(): Promise<void> {
    const existing = await this.state.storage.getAlarm();
    if (existing == null) {
      await this.state.storage.setAlarm(Date.now() + ALARM_PERIOD_MS);
    }
  }

  async pull(n: number): Promise<QuantumBytes> {
    await this.ensureAlarm();
    const pool = ((await this.state.storage.get<Uint8Array>('pool')) ?? new Uint8Array());
    let qrngBytes: number[];
    let pseudoBytes: number[];
    if (pool.length >= n) {
      qrngBytes = Array.from(pool.subarray(0, n));
      const rest = pool.subarray(n);
      await this.state.storage.put('pool', new Uint8Array(rest));
      pseudoBytes = [];
    } else {
      qrngBytes = Array.from(pool);
      const need = n - qrngBytes.length;
      const buf = new Uint8Array(need);
      crypto.getRandomValues(buf);
      pseudoBytes = Array.from(buf);
      await this.state.storage.put('pool', new Uint8Array());
    }
    const remaining = (await this.state.storage.get<Uint8Array>('pool'))?.length ?? 0;
    if (remaining < LOW_WATERMARK && !this.refillInFlight) {
      this.state.waitUntil(this.refill().catch(() => false));
    }
    const bytes = [...qrngBytes, ...pseudoBytes];
    let source: QuantumBytes['source'];
    if (pseudoBytes.length === 0) source = 'qrng';
    else if (qrngBytes.length === 0) source = 'pseudo';
    else source = 'mixed';
    return { bytes, source };
  }

  async refill(): Promise<boolean> {
    if (this.refillInFlight) return false;
    this.refillInFlight = true;
    try {
      const pool = ((await this.state.storage.get<Uint8Array>('pool')) ?? new Uint8Array());
      if (pool.length >= HIGH_WATERMARK) return true;
      const res = await fetch(ANU_URL, {
        headers: { 'user-agent': this.env.USER_AGENT },
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { success?: boolean; data?: number[] };
      if (!data?.success || !Array.isArray(data.data) || data.data.length === 0) return false;
      const fresh = new Uint8Array(data.data);
      const merged = new Uint8Array(pool.length + fresh.length);
      merged.set(pool, 0);
      merged.set(fresh, pool.length);
      const trimmed = merged.length > HIGH_WATERMARK ? merged.subarray(0, HIGH_WATERMARK) : merged;
      await this.state.storage.put('pool', new Uint8Array(trimmed));
      return true;
    } catch {
      return false;
    } finally {
      this.refillInFlight = false;
    }
  }

  async alarm(): Promise<void> {
    const pool = ((await this.state.storage.get<Uint8Array>('pool')) ?? new Uint8Array());
    if (pool.length < LOW_WATERMARK) {
      await this.refill().catch(() => false);
    }
    await this.state.storage.setAlarm(Date.now() + ALARM_PERIOD_MS);
  }
}

export async function pullQuantumBytes(env: Env, n: number): Promise<QuantumBytes> {
  const id = env.QUANTUM_DO.idFromName('reservoir');
  const stub = env.QUANTUM_DO.get(id);
  const res = await stub.fetch(`https://quantum/pull?n=${n}`);
  if (!res.ok) {
    const buf = new Uint8Array(n);
    crypto.getRandomValues(buf);
    return { bytes: Array.from(buf), source: 'pseudo' };
  }
  return (await res.json()) as QuantumBytes;
}
