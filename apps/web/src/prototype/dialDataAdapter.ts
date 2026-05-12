import type { LocationType, StateVector } from '@hero-syndrome/shared';
import { metaToPlan, moonPhaseForDate } from '@hero-syndrome/musical-schema';
import type { DialDemoSnapshot } from '../data/dynamicDialDemo';
import { phaseFromHour } from './dialViewModel';

export function snapshotFromStateVector(stateVector: StateVector, fallback: DialDemoSnapshot): DialDemoSnapshot {
  const locationType = inferLocationType(stateVector);
  const moonPhase = moonPhaseForDate(new Date(stateVector.timestamp));
  const { stacked, renderPlan } = metaToPlan(
    {
      timePhase: stateVector.time.phase,
      dayOfWeek: stateVector.time.dayOfWeek,
      weatherCondition: stateVector.weather?.condition ?? 'mainly_clear',
      moonPhase,
      bodyActivity: stateVector.location?.bodyActivity ?? 'still',
      locationType,
    },
    { seed: `dial:${stateVector.timestamp}:${locationType}` },
  );
  const moodTags = topMoodTags(stacked.mood);

  return {
    id: `live-${stateVector.timestamp}`,
    label: 'Live device data',
    stateVector: {
      ...stateVector,
      time: {
        ...stateVector.time,
        phase: phaseFromHour(stateVector.time.hour),
      },
    },
    derived: {
      locationType,
      moonPhase,
      phraseOfTheMoment: fallback.derived.phraseOfTheMoment,
      renderPlan: {
        bpm: renderPlan.bpm,
        key: keyForState(stateVector, stacked.energy.tension),
        totalDurationMs: renderPlan.totalDurationMs,
      },
      stacked: {
        energy: stacked.energy,
        moodTags,
        world: stacked.inspiration.world,
        textureKeys: stacked.inspiration.textureKeys,
      },
    },
  };
}

function topMoodTags(mood: Record<string, number>, count = 6): string[] {
  return Object.entries(mood)
    .filter(([, value]) => value > 0.08)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([tag]) => tag);
}

function keyForState(stateVector: StateVector, tension: number): string {
  if (stateVector.weather?.condition.includes('rain')) return 'D minor';
  if (stateVector.time.phase === 'night' || stateVector.time.phase === 'witching_hour') return 'F minor';
  if (tension > 0.65) return 'A minor';
  if ((stateVector.location?.bodyActivity ?? 'still') === 'running') return 'E minor';
  return 'C major';
}

function inferLocationType(stateVector: StateVector): LocationType {
  const place = stateVector.location?.place;
  const road = stateVector.location?.road;
  const category = place?.category.toLowerCase() ?? '';
  const type = place?.type.toLowerCase() ?? '';
  const roadClass = road?.class.toLowerCase() ?? '';
  const nearby = stateVector.location?.nearby ?? [];
  const tokens = [category, type, roadClass, ...nearby.slice(0, 3).flatMap((item) => [item.category, item.type])]
    .join(' ')
    .toLowerCase();

  if (tokens.includes('office') || tokens.includes('company')) return 'office';
  if (tokens.includes('cowork')) return 'co_working_space';
  if (tokens.includes('factory') || tokens.includes('warehouse')) return 'factory_or_warehouse';
  if (tokens.includes('construction')) return 'construction_site';
  if (tokens.includes('cafe')) return 'cafe';
  if (tokens.includes('restaurant')) return 'restaurant';
  if (tokens.includes('bar') || tokens.includes('pub')) return 'bar_or_pub';
  if (tokens.includes('nightclub')) return 'nightclub';
  if (tokens.includes('fast_food')) return 'fast_food';
  if (tokens.includes('shop')) return 'retail_shop';
  if (tokens.includes('mall')) return 'shopping_mall';
  if (tokens.includes('supermarket')) return 'supermarket';
  if (tokens.includes('market')) return 'outdoor_market';
  if (tokens.includes('station') && tokens.includes('rail')) return 'train_station';
  if (tokens.includes('bus')) return 'bus_station';
  if (tokens.includes('airport') || tokens.includes('aeroway')) return 'airport';
  if (tokens.includes('subway') || tokens.includes('metro')) return 'subway_or_metro';
  if (tokens.includes('tunnel') || tokens.includes('underpass')) return 'tunnel_or_underpass';
  if (tokens.includes('motorway') || tokens.includes('highway')) return 'highway_or_motorway';
  if (tokens.includes('parking')) return 'parking_lot_or_garage';
  if (tokens.includes('park')) return 'park_urban';
  if (tokens.includes('plaza') || tokens.includes('square')) return 'plaza_or_public_square';
  if (tokens.includes('rooftop')) return 'rooftop';
  if (tokens.includes('alley')) return 'alleyway_or_back_street';
  if (tokens.includes('forest') || tokens.includes('wood')) return 'forest_or_woods';
  if (tokens.includes('mountain') || tokens.includes('hill')) return 'mountain_or_hills';
  if (tokens.includes('beach') || tokens.includes('coast')) return 'beach_or_coast';
  if (tokens.includes('river') || tokens.includes('lake')) return 'river_or_lake';
  if (tokens.includes('museum') || tokens.includes('gallery')) return 'museum_or_gallery';
  if (tokens.includes('library')) return 'library';
  if (tokens.includes('theatre') || tokens.includes('cinema')) return 'theatre_or_cinema';
  if (tokens.includes('concert')) return 'concert_venue';
  if (tokens.includes('stadium') || tokens.includes('arena')) return 'stadium_or_arena';
  if (tokens.includes('fitness') || tokens.includes('gym')) return 'gym_or_fitness';
  if (tokens.includes('school') || tokens.includes('university')) return 'school_or_university';
  if (tokens.includes('hospital') || tokens.includes('clinic')) return 'hospital_or_clinic';
  if (tokens.includes('government')) return 'government_building';
  if (tokens.includes('worship') || tokens.includes('temple') || tokens.includes('church')) return 'place_of_worship';
  if (tokens.includes('historic')) return 'historic_site';
  if (stateVector.location?.speedMps && stateVector.location.speedMps > 1) return 'on_foot_street';
  if (category.includes('house') || type.includes('residential')) return 'home_interior';
  return 'unknown';
}
