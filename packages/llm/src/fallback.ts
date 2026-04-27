import type {
  Composition,
  SongMetadata,
  StateVector,
  Sticker,
  TransitionIntent,
} from '@hero-syndrome/shared';

export interface FallbackInput {
  stateVector: StateVector;
  stickers: Sticker[];
  recentIntent?: TransitionIntent;
}

export interface FallbackResult {
  metadata: SongMetadata;
  composition: Composition;
}

const PHASE_PALETTE: Record<string, { instrumentation: string[]; key: string; bpm: [number, number]; genre: string[] }> = {
  dawn: { instrumentation: ['warm pad', 'felt piano'], key: 'F major', bpm: [56, 70], genre: ['ambient', 'neo-classical'] },
  morning: { instrumentation: ['nylon guitar', 'rhodes', 'soft brushes'], key: 'C major', bpm: [78, 96], genre: ['neo-classical'] },
  noon: { instrumentation: ['acoustic guitar', 'upright bass'], key: 'G major', bpm: [88, 110], genre: ['folk-inflected'] },
  afternoon: { instrumentation: ['electric piano', 'ride cymbal', 'flute'], key: 'D mixolydian', bpm: [82, 102], genre: ['contemplative'] },
  goldenHour: { instrumentation: ['solo cello', 'tape hiss', 'warm pad'], key: 'A minor', bpm: [62, 78], genre: ['cinematic', 'ambient'] },
  dusk: { instrumentation: ['arpeggiated synth', 'bowed bass', 'choir pad'], key: 'E minor', bpm: [70, 88], genre: ['ambient'] },
  night: { instrumentation: ['analog pad', 'low drone', 'distant rim shot'], key: 'B minor', bpm: [60, 76], genre: ['drone', 'ambient'] },
  witchingHour: { instrumentation: ['detuned strings', 'sub bass', 'whispered choir pad'], key: 'F# minor', bpm: [54, 68], genre: ['drone', 'dark-ambient'] },
};

function intensityDescriptor(v: number): string {
  if (v < 0.15) return 'dormant';
  if (v < 0.35) return 'still';
  if (v < 0.6) return 'gentle';
  if (v < 0.8) return 'active';
  return 'intense';
}

export function ruleTableComposition(input: FallbackInput): FallbackResult {
  const { stateVector, stickers } = input;
  const phase = stateVector.time.phase;
  const palette = PHASE_PALETTE[phase] ?? PHASE_PALETTE.afternoon!;
  const intensity = stateVector.movement.intensityNormalized;
  const intensityWord = intensityDescriptor(intensity);
  const condition = stateVector.weather?.condition ?? 'clear';
  const placeType = stateVector.location?.placeType ?? 'unknown';
  const stickerHint = stickers.length > 0 ? `mood stickers active: ${stickers.map((s) => s.emoji).join(' ')}.` : '';

  const transitionIntent: TransitionIntent =
    stickers.length > 0 ? 'break' : input.recentIntent === 'continue' ? 'evolve' : 'continue';

  const bpm: [number, number] = [
    Math.round(palette.bpm[0] + intensity * 12),
    Math.round(palette.bpm[1] + intensity * 18),
  ];

  const overallPrompt = `An instrumental composition for ${phase}, ${intensityWord} intensity, ${condition} weather, in or around a ${placeType} place. ${stickerHint} Lead instruments: ${palette.instrumentation.join(', ')}. Key: ${palette.key}. BPM range ${bpm[0]}-${bpm[1]}.`;

  const intro = `Slow ${palette.instrumentation[0]} introduction in ${palette.key}, BPM ${bpm[0]}, ${intensityWord} energy, no drums.`;
  const middle = `Develop the theme. Add ${palette.instrumentation[1] ?? 'subtle pad'}, BPM ${Math.round((bpm[0] + bpm[1]) / 2)}. ${intensityWord} intensity. ${condition} weather flavoring.`;
  const outro = `Soft outro, ${palette.instrumentation[0]} alone, BPM ${bpm[0]}, fading.`;

  return {
    metadata: {
      bpmRange: bpm,
      key: palette.key,
      intensity,
      instrumentation: palette.instrumentation,
      genreTags: palette.genre,
      transitionIntent,
    },
    composition: {
      overallPrompt,
      sections: [
        { label: 'intro', durationSec: 40, prompt: intro },
        { label: 'middle', durationSec: 110, prompt: middle },
        { label: 'outro', durationSec: 40, prompt: outro },
      ],
    },
  };
}
