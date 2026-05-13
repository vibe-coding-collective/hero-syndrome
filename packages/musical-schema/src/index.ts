import type { PipelineInput, PipelineOptions, MetaToPlanResult } from './types';
import { buildRenderPlan } from './renderPlan';
import { stackMeta } from './stack';

export * from './types';
export * from './constants';
export * from './normalize';
export * from './energyQuantize';
export * from './moonPhase';
export * from './lexicons';
export { stackMeta } from './stack';
export { buildRenderPlan } from './renderPlan';

/**
 * End-to-end: raw inputs → stacked meta → render plan (BPM, duration).
 * Per Q2 / option b-i: lexicon rendering is NOT performed here; Claude
 * receives `MetaToPlanResult` as structured context and composes the final
 * `composition_plan` itself.
 */
export function metaToPlan(
  input: PipelineInput,
  options?: PipelineOptions,
): MetaToPlanResult {
  const seed = options?.seed ?? 'default-seed';
  // 75s per song gives the audio engine's 5s crossfade ramp ~70s of full-
  // volume listening before the next song fades in. Shorter requests
  // (e.g. 60s) sometimes returned ~55s of audio from ElevenLabs and the
  // crossfade started painfully early (~50s).
  const totalDurationMs = options?.totalDurationMs ?? 75_000;

  const stackOpts: Parameters<typeof stackMeta>[1] = {};
  if (options?.undertowSmooth) stackOpts.undertowSmooth = options.undertowSmooth;
  if (options?.lunarStrength != null) stackOpts.lunarStrength = options.lunarStrength;
  if (options?.undertowInstantStrength != null) {
    stackOpts.undertowInstantStrength = options.undertowInstantStrength;
  }
  const stacked = stackMeta(input, stackOpts);

  const renderPlan = buildRenderPlan(
    stacked,
    {
      dayOfWeek: input.dayOfWeek,
      ...(input.bodyActivity ? { bodyActivity: input.bodyActivity } : {}),
      ...(input.locationType ? { locationType: input.locationType } : {}),
    },
    seed,
    totalDurationMs,
  );

  return { stacked, renderPlan };
}
