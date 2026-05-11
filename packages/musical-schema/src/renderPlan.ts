import { MAX_BPM, MIN_BPM, PHASE_BPM_MULT } from './constants';
import type { PipelineInput, RenderPlan, StackedMeta } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Derive BPM and timing budget from the stacked meta. Widened from Jeremy's
 * 44–120 ceiling to 44–176 to match the prior project's BPM range while
 * keeping his motion-driven lerp and per-phase multipliers.
 */
export function buildRenderPlan(
  meta: StackedMeta,
  input: Pick<PipelineInput, 'dayOfWeek' | 'bodyActivity' | 'locationType'>,
  seed: string,
  totalDurationMs: number,
): RenderPlan {
  const motion = clamp(meta.energy.motion, 0, 1);
  const baseBpm = MIN_BPM + (MAX_BPM - MIN_BPM) * motion;
  const bpm = clamp(
    Math.round(baseBpm * PHASE_BPM_MULT[meta.timePhase]),
    MIN_BPM - 4,
    MAX_BPM + 4,
  );

  const plan: RenderPlan = {
    meta,
    bpm,
    totalDurationMs,
    seed,
    dayOfWeek: input.dayOfWeek,
  };
  if (input.bodyActivity) plan.bodyActivity = input.bodyActivity;
  if (input.locationType) plan.locationType = input.locationType;
  return plan;
}
