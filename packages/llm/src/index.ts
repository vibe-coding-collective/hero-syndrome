export {
  composeSong,
  describeSong,
  generateTitle,
  rateEvocativenessBatch,
  classifyLocation,
  AnthropicError,
  COMPOSE_SYSTEM_PROMPT,
  DESCRIBE_SYSTEM_PROMPT,
  LOCATION_CLASSIFY_SYSTEM_PROMPT,
} from './anthropic';
export type {
  ComposeSongInput,
  ComposeSongResult,
  DescribeSongInput,
  DescribeSongResult,
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
