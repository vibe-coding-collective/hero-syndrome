import type { WeatherRes } from '@hero-syndrome/shared';
import { wmoToCondition } from './derivations/wmoCondition';
import { readJsonCache, roundCoord, writeJsonCache } from './kv';
import type { Env } from './types';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    wind_speed_10m: number;
    is_day: number;
  };
  daily?: {
    sunrise: string[];
    sunset: string[];
  };
}

function minutesBetween(aIso: string, bIso: string): number {
  return (new Date(aIso).getTime() - new Date(bIso).getTime()) / 60000;
}

export async function getWeather(env: Env, lat: number, lon: number): Promise<WeatherRes> {
  const key = `wx:${roundCoord(lat)}:${roundCoord(lon)}`;
  const cached = await readJsonCache<WeatherRes>(env, key);
  if (cached) return cached;

  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,is_day',
  );
  url.searchParams.set('daily', 'sunrise,sunset');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetch(url, { headers: { 'user-agent': env.USER_AGENT } });
  if (!res.ok) throw new Error(`open-meteo failed (${res.status})`);
  const data = (await res.json()) as OpenMeteoResponse;
  if (!data.current) throw new Error('open-meteo missing current');

  const c = data.current;
  const nowIso = c.time;
  const sunrise = data.daily?.sunrise?.[0];
  const sunset = data.daily?.sunset?.[0];

  const out: WeatherRes = {
    tempC: c.temperature_2m,
    feelsLikeC: c.apparent_temperature,
    humidityPct: c.relative_humidity_2m,
    condition: wmoToCondition(c.weather_code),
    precipitationMmHr: c.precipitation,
    cloudCoverPct: c.cloud_cover,
    windMps: c.wind_speed_10m,
    isDay: c.is_day === 1,
    sunriseProximityMin: sunrise ? minutesBetween(nowIso, sunrise) : 0,
    sunsetProximityMin: sunset ? minutesBetween(nowIso, sunset) : 0,
  };
  await writeJsonCache(env, key, out, 600);
  return out;
}
