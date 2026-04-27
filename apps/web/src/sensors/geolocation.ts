export interface GeoReading {
  lat: number;
  lon: number;
  speedMps: number;
  heading: number | null;
  accuracyM: number;
  ts: number;
}

export class GeolocationSensor {
  private watchId: number | null = null;
  private listeners = new Set<(r: GeoReading) => void>();
  private last: GeoReading | null = null;

  start(): void {
    if (!('geolocation' in navigator)) return;
    if (this.watchId != null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const reading: GeoReading = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          speedMps: pos.coords.speed ?? 0,
          heading: pos.coords.heading,
          accuracyM: pos.coords.accuracy,
          ts: pos.timestamp,
        };
        this.last = reading;
        for (const fn of this.listeners) fn(reading);
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 30_000 },
    );
  }

  stop(): void {
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  subscribe(fn: (r: GeoReading) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  current(): GeoReading | null {
    return this.last;
  }
}

export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}
