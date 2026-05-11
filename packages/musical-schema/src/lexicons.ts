import body from '../data/lexicon/body.json' with { type: 'json' };
import day from '../data/lexicon/day.json' with { type: 'json' };
import energy from '../data/lexicon/energy.json' with { type: 'json' };
import location from '../data/lexicon/location.json' with { type: 'json' };
import mood from '../data/lexicon/mood.json' with { type: 'json' };
import moon from '../data/lexicon/moon.json' with { type: 'json' };
import negatives from '../data/lexicon/negatives.json' with { type: 'json' };
import product from '../data/lexicon/product.json' with { type: 'json' };
import sectionArchetypes from '../data/lexicon/section-archetypes.json' with { type: 'json' };
import texture from '../data/lexicon/texture.json' with { type: 'json' };
import weather from '../data/lexicon/weather.json' with { type: 'json' };
import world from '../data/lexicon/world.json' with { type: 'json' };
import type { TimePhase, WeatherCondition, MoonPhase, BodyActivity, LocationType, DayOfWeek } from '@hero-syndrome/shared';

export interface WeatherLexEntry {
  scene: string[];
  texture_hints: string[];
}

export interface SectionArchetype {
  id: string;
  section_name: string;
  duration_weight: number;
  positive_local_styles: string[];
  negative_local_styles: string[];
}

export interface Lexicons {
  product: { instrumental_positives: string[]; instrumental_negatives: string[] };
  world: Record<string, string[]>;
  texture: Record<string, string[]>;
  mood: Record<string, string[]>;
  weather: Record<WeatherCondition, WeatherLexEntry>;
  moon: {
    tide_dynamics: Record<'high_spring' | 'mid' | 'low_neap', string[]>;
    undertow: Record<MoonPhase, string[]>;
  };
  energy: {
    motion: Record<string, string[]>;
    density: Record<string, string[]>;
    tension: Record<string, string[]>;
    brightness: Record<string, string[]>;
  };
  body: Record<BodyActivity, string[]>;
  day: Record<string, string[]>;
  location: Record<LocationType, string[]>;
  negatives: { fixed: string[]; conditional: Record<string, string[]> };
  sectionArchetypes: Record<TimePhase, SectionArchetype[]>;
}

export const LEXICONS: Lexicons = {
  product: product as Lexicons['product'],
  world: world as Lexicons['world'],
  texture: texture as Lexicons['texture'],
  mood: mood as Lexicons['mood'],
  weather: weather as Lexicons['weather'],
  moon: moon as Lexicons['moon'],
  energy: energy as Lexicons['energy'],
  body: body as Lexicons['body'],
  day: day as Lexicons['day'],
  location: location as Lexicons['location'],
  negatives: negatives as Lexicons['negatives'],
  sectionArchetypes: sectionArchetypes as Lexicons['sectionArchetypes'],
};

function dayKey(d: DayOfWeek): string {
  return d.toLowerCase();
}

/**
 * Compact dict of just the lexicon phrases relevant to a given stacked meta +
 * inputs. Intended to be embedded in Claude's prompt as authored vocabulary
 * for the renderer to draw from, without dumping all 12 files every call.
 */
export interface LexiconContextInput {
  timePhase: TimePhase;
  weatherCondition: WeatherCondition;
  moonPhase: MoonPhase;
  dayOfWeek: DayOfWeek;
  bodyActivity?: BodyActivity;
  locationType?: LocationType;
  /** Mood tag names that are active (weight ≥ threshold). */
  activeMoodTags: string[];
  /** Texture key ids from inspiration. */
  textureKeys: string[];
  /** World id(s). */
  worldIds: string[];
}

export interface LexiconContext {
  product_positives: string[];
  product_negatives: string[];
  worlds: Record<string, string[]>;
  textures: Record<string, string[]>;
  moods: Record<string, string[]>;
  weather: WeatherLexEntry;
  moon_undertow: string[];
  moon_tide_dynamics: Record<'high_spring' | 'mid' | 'low_neap', string[]>;
  day: string[];
  body?: string[];
  location?: string[];
  negatives_fixed: string[];
}

export function buildLexiconContext(input: LexiconContextInput): LexiconContext {
  const out: LexiconContext = {
    product_positives: LEXICONS.product.instrumental_positives,
    product_negatives: LEXICONS.product.instrumental_negatives,
    worlds: {},
    textures: {},
    moods: {},
    weather: LEXICONS.weather[input.weatherCondition],
    moon_undertow: LEXICONS.moon.undertow[input.moonPhase] ?? [],
    moon_tide_dynamics: LEXICONS.moon.tide_dynamics,
    day: LEXICONS.day[dayKey(input.dayOfWeek)] ?? [],
    negatives_fixed: LEXICONS.negatives.fixed,
  };
  for (const id of input.worldIds) {
    const pool = LEXICONS.world[id];
    if (pool) out.worlds[id] = pool;
  }
  for (const id of input.textureKeys) {
    const pool = LEXICONS.texture[id];
    if (pool) out.textures[id] = pool;
  }
  for (const tag of input.activeMoodTags) {
    const pool = LEXICONS.mood[tag];
    if (pool) out.moods[tag] = pool;
  }
  if (input.bodyActivity) out.body = LEXICONS.body[input.bodyActivity];
  if (input.locationType) out.location = LEXICONS.location[input.locationType];
  return out;
}
