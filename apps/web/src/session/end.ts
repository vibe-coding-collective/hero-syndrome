import { api } from '../api/client';
import { setMediaSessionPlaybackState } from '../audio/mediaSession';
import { clearActiveRuntime, getActiveRuntime } from './start';
import { useStore } from '../state/store';

export async function endScene(): Promise<{ episodeId: string; shareUrl: string } | null> {
  const runtime = getActiveRuntime();
  const sessionId = useStore.getState().sessionId;
  if (!runtime || !sessionId) return null;
  try {
    await runtime.engine.fadeOut(2000);
  } catch { /* ignore */ }
  setMediaSessionPlaybackState('paused');
  let res: { episodeId: string; shareUrl: string } | null = null;
  try {
    res = await api.finalize(sessionId, { endedAt: new Date().toISOString() });
  } catch (err) {
    console.error('finalize failed', err);
  }
  clearActiveRuntime();
  if (res) {
    useStore.getState().setEpisode({ episodeId: res.episodeId, shareUrl: res.shareUrl });
    useStore.getState().setSession({ endedAt: Date.now() });
  }
  return res;
}
