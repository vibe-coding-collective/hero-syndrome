export interface AudioEngineEvents {
  onSongStart?: (songId: string, startedAtMs: number, durationSec: number) => void;
  onNeedNext?: () => void;
  onTailLoopExpired?: () => void;
  onAllEnded?: () => void;
}

interface ActiveSlot {
  source: AudioBufferSourceNode;
  gain: GainNode;
  buffer: AudioBuffer;
  songId: string;
  startedAt: number; // AudioContext time
}

interface QueuedSlot {
  source: AudioBufferSourceNode;
  gain: GainNode;
  buffer: AudioBuffer;
  songId: string;
}

const RAMP_SEC = 5;
const DEFAULT_LEAD_SEC = 90;
const TAIL_LOOP_CAP_MS = 10_000;

/** Audio crossfade ramp length in seconds. Exported so the dial's progress
 *  ring can complete at the moment the next song starts fading in, matching
 *  what the user actually hears. */
export const AUDIO_RAMP_SEC = RAMP_SEC;

/** Below this absolute sample value, audio counts as silence for the purpose
 *  of trimming buffer tails. ~-46dB. */
const SILENCE_THRESHOLD = 0.005;
/** Always keep at least this much tail after the last audible sample so a
 *  natural fade isn't clipped. */
const MIN_TAIL_MS = 250;

export class AudioEngine {
  ctx: AudioContext;
  master: GainNode;
  analyser: AnalyserNode;

  private current: ActiveSlot | null = null;
  private next: QueuedSlot | null = null;
  private events: AudioEngineEvents;
  private needNextTimer: number | null = null;
  private leadSec = DEFAULT_LEAD_SEC;
  private tailLoopActive = false;

  constructor(events: AudioEngineEvents = {}, providedCtx?: AudioContext) {
    if (providedCtx) {
      this.ctx = providedCtx;
    } else {
      const Ctor = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext;
      this.ctx = new Ctor();
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.85;
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.events = events;
  }

  /**
   * Build an AudioContext + play a brief silent buffer synchronously inside
   * a user-gesture handler. iOS Safari's autoplay rules require this to
   * "unlock" Web Audio for the lifetime of the page; without it, fetches
   * resolve but `decodeAudioData` and source playback hang forever.
   *
   * Also starts a permanently-running zero-gain oscillator so Chrome can't
   * decide the graph is idle and reclaim it during the 30+ second wait
   * before song 1 arrives. (Empty preludes manifest = the user clicks
   * "Begin scene" and then nothing audible happens until ElevenLabs
   * returns; a context with no scheduled output across that window has
   * been observed to drop the first real song silently.)
   */
  static unlockedContext(): AudioContext {
    const Ctor = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') {
      // Fire-and-forget; iOS won't reject within the gesture window.
      void ctx.resume();
    }
    const empty = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = empty;
    src.connect(ctx.destination);
    try { src.start(0); } catch { /* ignore */ }

    const keepAliveOsc = ctx.createOscillator();
    keepAliveOsc.frequency.value = 1;
    const keepAliveGain = ctx.createGain();
    keepAliveGain.gain.value = 0;
    keepAliveOsc.connect(keepAliveGain);
    keepAliveGain.connect(ctx.destination);
    try { keepAliveOsc.start(0); } catch { /* ignore */ }

    return ctx;
  }

  setEvents(events: AudioEngineEvents): void {
    this.events = events;
  }

  setLeadSec(seconds: number): void {
    this.leadSec = Math.max(20, Math.min(180, seconds));
  }

  async ensureRunning(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private async fetchAndDecode(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`audio fetch failed (${res.status})`);
    const buf = await res.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(buf);
    return this.trimTrailingSilence(decoded);
  }

  /** Strip pure trailing silence from a decoded buffer. ElevenLabs renderings
   *  sometimes pad audio with 1–3 seconds of silence at the end; overlaying
   *  our 5s crossfade onto that creates a perceived gap between songs. We
   *  scan back from the end for the first audible sample and keep a small
   *  tail (MIN_TAIL_MS) so any natural fade isn't truncated. */
  private trimTrailingSilence(buffer: AudioBuffer): AudioBuffer {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    if (length === 0) return buffer;
    const channelData: Float32Array[] = [];
    for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c));

    let lastAudible = -1;
    for (let i = length - 1; i >= 0; i--) {
      let maxAbs = 0;
      for (let c = 0; c < channels; c++) {
        const v = Math.abs(channelData[c]![i]!);
        if (v > maxAbs) maxAbs = v;
      }
      if (maxAbs > SILENCE_THRESHOLD) {
        lastAudible = i;
        break;
      }
    }
    if (lastAudible < 0) return buffer; // entirely silent, return as-is

    const sampleRate = buffer.sampleRate;
    const minTailFrames = Math.floor((MIN_TAIL_MS / 1000) * sampleRate);
    const trimmedLength = Math.min(length, lastAudible + 1 + minTailFrames);
    // Don't bother trimming if there's less than ~100ms of silence to remove.
    if (length - trimmedLength < Math.floor(sampleRate * 0.1)) return buffer;

    const trimmed = this.ctx.createBuffer(channels, trimmedLength, sampleRate);
    for (let c = 0; c < channels; c++) {
      // Slice into a fresh Float32Array (its backing ArrayBuffer is plain,
      // satisfying the copyToChannel TS signature that demands ArrayBuffer
      // rather than ArrayBufferLike).
      const slice = new Float32Array(channelData[c]!.subarray(0, trimmedLength));
      trimmed.copyToChannel(slice, c);
    }
    return trimmed;
  }

  private makeSlot(buffer: AudioBuffer): { source: AudioBufferSourceNode; gain: GainNode } {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(this.master);
    return { source, gain };
  }

  async start(url: string, songId: string): Promise<void> {
    await this.ensureRunning();
    const buffer = await this.fetchAndDecode(url);
    if (this.current) {
      this.stop();
    }
    const { source, gain } = this.makeSlot(buffer);
    const startedAt = this.ctx.currentTime;
    source.start(startedAt);
    this.current = { source, gain, buffer, songId, startedAt };
    this.events.onSongStart?.(songId, performance.now(), buffer.duration);
    this.scheduleNeedNext();
    this.scheduleTailLoopIfNoNext();
  }

  async enqueue(url: string, songId: string): Promise<void> {
    if (!this.current) {
      await this.start(url, songId);
      return;
    }
    if (this.next) {
      // already queued; replace (newer is better)
      try {
        this.next.source.stop(0);
      } catch { /* ignore */ }
      this.next = null;
    }
    const buffer = await this.fetchAndDecode(url);
    const { source, gain } = this.makeSlot(buffer);
    this.next = { source, gain, buffer, songId };
    this.cancelTailLoop();
    this.scheduleTransition();
  }

  private scheduleTransition(): void {
    const cur = this.current;
    const nxt = this.next;
    if (!cur || !nxt) return;
    const endTime = cur.startedAt + cur.buffer.duration;
    const rampStart = Math.max(this.ctx.currentTime, endTime - RAMP_SEC);
    cur.gain.gain.cancelScheduledValues(rampStart);
    cur.gain.gain.setValueAtTime(cur.gain.gain.value, rampStart);
    cur.gain.gain.linearRampToValueAtTime(0, endTime);

    nxt.source.start(rampStart);
    nxt.gain.gain.setValueAtTime(0, rampStart);
    nxt.gain.gain.linearRampToValueAtTime(1, rampStart + RAMP_SEC);

    const swapAtMs = (endTime - this.ctx.currentTime) * 1000;
    window.setTimeout(() => this.swapRoles(), Math.max(0, swapAtMs));
  }

  private swapRoles(): void {
    const nxt = this.next;
    if (!nxt) return;
    const startedAt = this.ctx.currentTime;
    if (this.current) {
      try {
        this.current.source.stop(this.ctx.currentTime + 0.05);
      } catch { /* ignore */ }
    }
    this.current = {
      source: nxt.source,
      gain: nxt.gain,
      buffer: nxt.buffer,
      songId: nxt.songId,
      startedAt,
    };
    this.next = null;
    this.events.onSongStart?.(this.current.songId, performance.now(), this.current.buffer.duration);
    this.scheduleNeedNext();
    this.scheduleTailLoopIfNoNext();
  }

  private scheduleNeedNext(): void {
    if (this.needNextTimer != null) {
      window.clearTimeout(this.needNextTimer);
    }
    const cur = this.current;
    if (!cur) return;
    const fireAtMs = Math.max(0, (cur.buffer.duration - this.leadSec) * 1000);
    this.needNextTimer = window.setTimeout(() => this.events.onNeedNext?.(), fireAtMs);
  }

  private scheduleTailLoopIfNoNext(): void {
    const cur = this.current;
    if (!cur) return;
    const tailStartAt = cur.startedAt + cur.buffer.duration;
    const tailStartInMs = (tailStartAt - this.ctx.currentTime) * 1000;
    window.setTimeout(() => {
      if (this.next || !this.current) return;
      // Tail-loop the last 3s under a low-pass filter, capped at 10s.
      this.startTailLoop();
    }, Math.max(0, tailStartInMs - 200));
  }

  private startTailLoop(): void {
    const cur = this.current;
    if (!cur) return;
    if (this.tailLoopActive) return;
    const buffer = cur.buffer;
    const sampleRate = buffer.sampleRate;
    const tailFrames = Math.min(buffer.length, sampleRate * 3);
    const start = buffer.length - tailFrames;
    const tail = this.ctx.createBuffer(buffer.numberOfChannels, tailFrames, sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      tail.copyToChannel(src.subarray(start, start + tailFrames), ch);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = tail;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.78;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // 1800Hz keeps melody + warmth audible (was 600Hz, which removed almost
    // everything and made the tail loop sound like silence to the user).
    filter.frequency.value = 1800;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    void filter;
    this.tailLoopActive = true;

    // Replace current with tail-loop slot so future enqueues swap correctly
    this.current = {
      source: source,
      gain: gain,
      buffer: tail,
      songId: `${cur.songId}.tail`,
      startedAt: this.ctx.currentTime,
    };

    window.setTimeout(() => {
      if (!this.tailLoopActive) return;
      // Cap reached and no next song: signal upstream to fall back to a prelude
      this.cancelTailLoop();
      this.events.onTailLoopExpired?.();
    }, TAIL_LOOP_CAP_MS);
  }

  private cancelTailLoop(): void {
    if (!this.tailLoopActive) return;
    this.tailLoopActive = false;
  }

  stop(): void {
    if (this.needNextTimer != null) {
      window.clearTimeout(this.needNextTimer);
      this.needNextTimer = null;
    }
    if (this.current) {
      try { this.current.source.stop(); } catch { /* ignore */ }
      this.current = null;
    }
    if (this.next) {
      try { this.next.source.stop(); } catch { /* ignore */ }
      this.next = null;
    }
    this.cancelTailLoop();
  }

  pauseAudio(): void {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.08);
  }

  resumeAudio(): void {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(1, t, 0.08);
  }

  fadeOut(durationMs = 2000): Promise<void> {
    return new Promise((resolve) => {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + durationMs / 1000);
      window.setTimeout(() => {
        this.stop();
        resolve();
      }, durationMs + 50);
    });
  }

  currentSongId(): string | null {
    return this.current?.songId ?? null;
  }

  hasNext(): boolean {
    return this.next != null;
  }

  remainingSec(): number {
    if (!this.current) return 0;
    return Math.max(0, this.current.startedAt + this.current.buffer.duration - this.ctx.currentTime);
  }
}

/** Module-level handoff slot. Landing CTAs unlock an AudioContext
 *  synchronously inside the click handler (iOS requirement) and stash it
 *  here, then navigate to /scene. Scene consumes the stash on mount and
 *  skips the permission gate, keeping the unlock from the original user
 *  gesture intact. */
let pendingUnlockedContext: AudioContext | null = null;

export function stashUnlockedContext(ctx: AudioContext): void {
  pendingUnlockedContext = ctx;
}

export function consumeUnlockedContext(): AudioContext | null {
  const ctx = pendingUnlockedContext;
  pendingUnlockedContext = null;
  return ctx;
}

export function peekUnlockedContext(): AudioContext | null {
  return pendingUnlockedContext;
}
