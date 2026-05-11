export {
  composeSong,
  generateTitle,
  rateEvocativenessBatch,
  classifyLocation,
  AnthropicError,
} from './anthropic';
export type {
  ComposeSongInput,
  ComposeSongResult,
  TitleInput,
  EvocativenessBatchInput,
  ClassifyLocationInput,
  ClassifyLocationResult,
} from './anthropic';

export { buildClaudePromptJson } from './transform';
export type { BuildPromptInput } from './transform';

export {
  renderComposition,
  renderCompositionWithRetry,
  ElevenLabsError,
} from './elevenlabs';
export type { RenderCompositionInput, RenderCompositionResult } from './elevenlabs';

export { ruleTableComposition } from './fallback';
export type { FallbackInput, FallbackResult } from './fallback';
