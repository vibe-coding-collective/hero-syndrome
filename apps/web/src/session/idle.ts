const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export class IdleWatcher {
  private hiddenSinceMs: number | null = null;
  private listener: () => void;
  private onIdle: () => void;

  constructor(onIdle: () => void) {
    this.onIdle = onIdle;
    this.listener = () => this.handleVisibilityChange();
  }

  start(): void {
    document.addEventListener('visibilitychange', this.listener);
  }

  stop(): void {
    document.removeEventListener('visibilitychange', this.listener);
    this.hiddenSinceMs = null;
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.hiddenSinceMs = Date.now();
    } else {
      const since = this.hiddenSinceMs;
      this.hiddenSinceMs = null;
      if (since && Date.now() - since > IDLE_TIMEOUT_MS) {
        this.onIdle();
      }
    }
  }
}
