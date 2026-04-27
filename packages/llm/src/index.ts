export {
  composeSong,
  generateTitle,
  rateEvocativenessBatch,
  AnthropicError,
} from './anthropic';
export type { ComposeSongInput, ComposeSongResult, TitleInput, EvocativenessBatchInput } from './anthropic';

export {
  renderComposition,
  renderCompositionWithRetry,
  ElevenLabsError,
} from './elevenlabs';
export type { RenderCompositionInput, RenderCompositionResult } from './elevenlabs';

export { ruleTableComposition } from './fallback';
export type { FallbackInput, FallbackResult } from './fallback';
