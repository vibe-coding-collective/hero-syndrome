// Astronomical solar position helpers. Pure astronomy / physics — no
// astrology, zodiac, or cultural cosmology. Used by the dial to:
//   - draw the sunrise/sunset horizon line accurately for any coordinates
//     (replaces the proximity-minutes round-trip through Open-Meteo, which
//     could be off by a day across the UTC dateline)
//   - drive an adaptive lightLevel that smoothly tracks real ambient
//     brightness (sun above/below horizon, civil/nautical twilight),
//     attenuated by cloud cover
//
// Implementation follows the standard low-precision formulas from
// NOAA's Solar Position Algorithm summary (good to within ~1 minute for
// sunrise/sunset times and within ~0.1° for elevation, which is plenty
// for visual cues).

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function toJulian(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

function fromJulian(j: number): Date {
  return new Date((j - 2_440_587.5) * 86_400_000);
}

function julianDaysSinceJ2000(date: Date): number {
  return toJulian(date) - 2_451_545.0;
}

function solarMeanAnomaly(d: number): number {
  return (357.5291 + 0.98560028 * d) * RAD;
}

function eclipticLongitude(M: number): number {
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * RAD;
  const P = 102.9372 * RAD;
  return M + C + P + Math.PI;
}

function declination(L: number): number {
  const obliquity = 23.4397 * RAD;
  return Math.asin(Math.sin(obliquity) * Math.sin(L));
}

function rightAscension(L: number): number {
  const obliquity = 23.4397 * RAD;
  return Math.atan2(Math.sin(L) * Math.cos(obliquity), Math.cos(L));
}

function siderealTime(d: number, lw: number): number {
  return (280.16 + 360.9856235 * d) * RAD - lw;
}

/** Sun altitude in degrees (positive = above horizon) for the given moment
 *  at lat/lon. */
export function sunElevationDeg(date: Date, lat: number, lon: number): number {
  const lw = -lon * RAD;
  const phi = lat * RAD;
  const d = julianDaysSinceJ2000(date);
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const H = siderealTime(d, lw) - rightAscension(L);
  const sinAlt = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  return Math.asin(sinAlt) * DEG;
}

/** Sunrise / sunset times (Date) for the calendar day containing `forDate`
 *  at lat/lon. The "calendar day" is interpreted in the timezone implied by
 *  longitude — i.e. local solar day, which is what the user perceives. */
export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
}

function julianCycle(d: number, lw: number): number {
  return Math.round(d - 0.0009 - lw / (2 * Math.PI));
}

function approxTransit(Ht: number, lw: number, n: number): number {
  return 0.0009 + (Ht + lw) / (2 * Math.PI) + n;
}

function solarTransitJ(ds: number, M: number, L: number): number {
  return 2_451_545.0 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
}

function hourAngle(h: number, phi: number, dec: number): number {
  const cosH = (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH > 1) return NaN; // sun never reaches this altitude (polar day/night)
  if (cosH < -1) return NaN;
  return Math.acos(cosH);
}

export function sunTimesFor(date: Date, lat: number, lon: number): SunTimes {
  const lw = -lon * RAD;
  const phi = lat * RAD;
  const d = julianDaysSinceJ2000(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);
  const horizonAngle = -0.833 * RAD; // standard sunrise/sunset refraction
  const w = hourAngle(horizonAngle, phi, dec);
  if (!Number.isFinite(w)) {
    // Polar day or polar night — fall back to neutral 06:00/18:00 local.
    const noon = fromJulian(Jnoon);
    return {
      sunrise: new Date(noon.getTime() - 6 * 3600_000),
      sunset: new Date(noon.getTime() + 6 * 3600_000),
      solarNoon: noon,
    };
  }
  const Jrise = solarTransitJ(approxTransit(-w, lw, n), M, L);
  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
  return {
    sunrise: fromJulian(Jrise),
    sunset: fromJulian(Jset),
    solarNoon: fromJulian(Jnoon),
  };
}

/** Local-time hour-of-day (0..24) of the given instant, computed against the
 *  longitude's natural solar offset rather than the device timezone. Useful
 *  for the dial's 24-hour clock display, which is anchored to the sun's
 *  apparent motion, not the user's civic clock. */
function localSolarHour(date: Date, lon: number): number {
  // Convert UTC to "longitudinal local time" by offsetting 4 minutes per
  // degree of longitude east of Greenwich.
  const utcMs = date.getTime();
  const offsetMs = lon * 4 * 60_000;
  const ms = utcMs + offsetMs;
  const seconds = (ms / 1000) % 86_400;
  return (seconds + 86_400) / 3600 % 24;
}

/** Convert a Date to the hour-of-day on the user's civic clock. */
export function dateToCivicHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export { localSolarHour };

/** Adaptive light level (0..1) at the user's location and moment.
 *  - Sun ≥ 6° above horizon → full daylight (1.0).
 *  - Sun between -6° and 6° → smooth twilight crossfade.
 *  - Sun ≤ -12° → deep night (0.05, never fully zero).
 *  - Cloud cover (0..100%) attenuates daylight up to 30%.
 *  - Without coords, falls back to the time phase passed in. */
export function computeLightLevel(args: {
  date: Date;
  lat?: number;
  lon?: number;
  cloudCoverPct?: number;
}): number {
  let base: number;
  if (args.lat != null && args.lon != null) {
    const alt = sunElevationDeg(args.date, args.lat, args.lon);
    if (alt >= 6) base = 1;
    else if (alt <= -12) base = 0.05;
    else {
      // Map [-12, 6] to [0.05, 1] with a smooth ramp.
      const t = (alt + 12) / 18;
      base = 0.05 + smoothstep(t) * 0.95;
    }
  } else {
    // Without coords, fall back to a flat midday-ish brightness.
    base = 0.7;
  }
  const cloud = clamp01((args.cloudCoverPct ?? 0) / 100);
  // Up to 30% attenuation for heavy overcast.
  const attenuated = base * (1 - cloud * 0.3);
  return clamp01(attenuated);
}

function smoothstep(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}
