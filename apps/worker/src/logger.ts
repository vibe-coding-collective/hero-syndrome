export interface RequestLog {
  ts: string;
  sessionId?: string;
  route: string;
  status: number;
  latencyMs: number;
  llmLatencyMs?: number;
  musicLatencyMs?: number;
  llmTokensIn?: number;
  llmTokensOut?: number;
  songDurationSec?: number;
  transitionIntent?: string;
  errCategory?: string;
}

export function logRequest(log: RequestLog): void {
  console.log(JSON.stringify(log));
}
