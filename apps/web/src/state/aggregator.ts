import type { StateVector } from '@hero-syndrome/shared';
import { readClock } from '../sensors/clock';
import { GeolocationSensor } from '../sensors/geolocation';
import { MotionSensor } from '../sensors/motion';
import { getNearby } from '../sensors/nearby';
import { getGeocode } from '../sensors/reverseGeocode';
import { getWeather } from '../sensors/weather';
import { useStore } from './store';

const SAMPLE_MS = 5000;

export class StateAggregator {
  private motion: MotionSensor;
  private geo: GeolocationSensor;
  private timer: number | null = null;
  private running = false;
  private firstTickResolve: (() => void) | null = null;
  private firstLocationTickResolve: (() => void) | null = null;
  readonly firstTick: Promise<void>;
  /** Resolves on the first tick that has a real `location` field (i.e. the
   *  geolocation sensor has produced at least one fix). Used by `startScene`
   *  to delay the very first /generate until weather + reverse-geocode have
   *  a chance to land; otherwise song 1 frequently goes out with no place
   *  or weather and the dial ends up with sparse readouts for the rest of
   *  the session. */
  readonly firstLocationTick: Promise<void>;

  constructor(motion: MotionSensor, geo: GeolocationSensor) {
    this.motion = motion;
    this.geo = geo;
    this.geo.subscribe((r) => this.motion.setGpsSpeed(r.speedMps));
    this.firstTick = new Promise<void>((resolve) => {
      this.firstTickResolve = resolve;
    });
    this.firstLocationTick = new Promise<void>((resolve) => {
      this.firstLocationTickResolve = resolve;
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), SAMPLE_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const clock = readClock();
    const motionReading = this.motion.read();
    const geo = this.geo.current();

    // Treadmill / cycling override: when the phone is held mostly still
    // (in pocket / on a rack) but accelerometer intensity is clearly high,
    // the step-detection classifier reports "still" and Claude composes a
    // calm song. Promote to "running" so the music engine treats it like
    // active exercise.
    const overriddenBodyActivity =
      motionReading.bodyActivity === 'still' && motionReading.intensityNormalized > 0.7
        ? 'running'
        : motionReading.bodyActivity;

    const sv: StateVector = {
      timestamp: clock.timestamp,
      time: { hour: clock.hour, phase: clock.phase, dayOfWeek: clock.dayOfWeek },
      movement: {
        intensityNormalized: motionReading.intensityNormalized,
        pattern: motionReading.pattern,
      },
    };

    if (geo) {
      sv.location = {
        speedMps: geo.speedMps,
        bodyActivity: overriddenBodyActivity,
        coords: { lat: geo.lat, lon: geo.lon },
      };

      try {
        const geocode = await getGeocode(geo.lat, geo.lon);
        if (geocode.place) sv.location.place = geocode.place;
        if (geocode.road) sv.location.road = geocode.road;
        if (geocode.neighborhood) sv.location.neighborhood = geocode.neighborhood;
        if (geocode.city) sv.location.city = geocode.city;
        if (geocode.country) sv.location.country = geocode.country;
      } catch { /* fail-soft */ }

      try {
        const nearby = await getNearby(geo.lat, geo.lon);
        if (nearby.length > 0) sv.location.nearby = nearby;
      } catch { /* fail-soft */ }

      // Nearby-venue promotion: when Nominatim's `place` is a generic
      // building polygon (or absent) AND a very-near POI is an actual
      // business/venue, promote that nearby into `place`. Catches cases
      // like "gym 13m away, place classified as building.house" — Claude
      // would have called the user's location `home_interior` despite
      // them being inside a gym. With this swap, the gym is the place.
      promoteNearestVenueIntoPlace(sv.location);

      try {
        const weather = await getWeather(geo.lat, geo.lon);
        sv.weather = weather;
      } catch { /* fail-soft */ }
    }

    const cosmic = useStore.getState().cosmic;
    if (cosmic) sv.cosmic = cosmic;

    useStore.getState().setStateVector(sv);
    if (this.firstTickResolve) {
      this.firstTickResolve();
      this.firstTickResolve = null;
    }
    if (sv.location && this.firstLocationTickResolve) {
      this.firstLocationTickResolve();
      this.firstLocationTickResolve = null;
    }
  }
}

/** Categories that Nominatim returns for buildings/streets but that don't
 *  identify a specific venue. When the immediate `place` is one of these,
 *  we look for a very-nearby venue to use instead. */
const GENERIC_PLACE_CATEGORIES = new Set(['building', 'highway', 'place', 'boundary']);

/** Categories that indicate a real venue (a business, public amenity, etc.).
 *  A nearby entry in one of these categories within `MAX_PROMOTION_DISTANCE_M`
 *  takes precedence over a generic immediate place. */
const VENUE_CATEGORIES = new Set([
  'amenity',
  'leisure',
  'shop',
  'tourism',
  'office',
  'sport',
  'healthcare',
  'craft',
]);

const MAX_PROMOTION_DISTANCE_M = 25;

function promoteNearestVenueIntoPlace(
  location: NonNullable<StateVector['location']>,
): void {
  const currentCategory = location.place?.category?.toLowerCase();
  const isGenericPlace = !currentCategory || GENERIC_PLACE_CATEGORIES.has(currentCategory);
  if (!isGenericPlace) return;

  const nearby = location.nearby ?? [];
  // Find the closest nearby that's a real venue within the promotion radius.
  let bestIdx = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < nearby.length; i += 1) {
    const item = nearby[i]!;
    if (item.distanceM > MAX_PROMOTION_DISTANCE_M) continue;
    if (!VENUE_CATEGORIES.has(item.category.toLowerCase())) continue;
    if (item.distanceM < bestDistance) {
      bestIdx = i;
      bestDistance = item.distanceM;
    }
  }
  if (bestIdx < 0) return;

  const winner = nearby[bestIdx]!;
  location.place = {
    category: winner.category,
    type: winner.type,
    ...(winner.name ? { name: winner.name } : {}),
  };
}
