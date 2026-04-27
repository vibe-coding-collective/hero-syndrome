export function setMediaSessionMetadata(opts: { title: string; artist?: string; album?: string }): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: opts.title,
      artist: opts.artist ?? 'Hero Syndrome',
      album: opts.album ?? 'A scene',
    });
  } catch { /* ignore */ }
}

export function setMediaSessionHandlers(handlers: {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (handlers.onPlay) navigator.mediaSession.setActionHandler('play', () => handlers.onPlay?.());
  if (handlers.onPause) navigator.mediaSession.setActionHandler('pause', () => handlers.onPause?.());
  if (handlers.onStop) {
    try { navigator.mediaSession.setActionHandler('stop', () => handlers.onStop?.()); } catch { /* not all browsers */ }
  }
  if (handlers.onPrev) navigator.mediaSession.setActionHandler('previoustrack', () => handlers.onPrev?.());
  if (handlers.onNext) navigator.mediaSession.setActionHandler('nexttrack', () => handlers.onNext?.());
}

export function setMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none'): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    (navigator.mediaSession as MediaSession).playbackState = state;
  } catch { /* ignore */ }
}
