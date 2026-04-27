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

  constructor(motion: MotionSensor, geo: GeolocationSensor) {
    this.motion = motion;
    this.geo = geo;
    this.geo.subscribe((r) => this.motion.setGpsSpeed(r.speedMps));
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
        motionClass: motionReading.motionClass,
        placeType: 'unknown',
      };

      try {
        const geocode = await getGeocode(geo.lat, geo.lon);
        sv.location.placeType = geocode.placeType;
        if (geocode.place) sv.location.place = geocode.place;
        if (geocode.road) sv.location.road = geocode.road;
        if (geocode.neighborhood) sv.location.neighborhood = geocode.neighborhood;
        if (geocode.city) sv.location.city = geocode.city;
      } catch { /* fail-soft */ }

      try {
        const nearby = await getNearby(geo.lat, geo.lon);
        if (nearby.length > 0) sv.location.nearby = nearby;
      } catch { /* fail-soft */ }

      try {
        const weather = await getWeather(geo.lat, geo.lon);
        sv.weather = weather;
      } catch { /* fail-soft */ }
    }

    const cosmic = useStore.getState().cosmic;
    if (cosmic) sv.cosmic = cosmic;

    useStore.getState().setStateVector(sv);
  }
}
