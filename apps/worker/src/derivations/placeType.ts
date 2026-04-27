import type { PlaceType } from '@hero-syndrome/shared';

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
}

export interface NominatimResult {
  category?: string;
  type?: string;
  name?: string;
  address?: NominatimAddress;
  extratags?: Record<string, string>;
  display_name?: string;
  class?: string;
}

export function derivePlaceType(r: NominatimResult): PlaceType {
  const cat = r.class ?? r.category ?? '';
  const type = r.type ?? '';
  const tag = `${cat}=${type}`;
  if (tag === 'leisure=park' || tag === 'boundary=national_park') return 'park';
  if (tag === 'natural=beach' || tag === 'natural=coastline') return 'coast';
  if (cat === 'natural' && type === 'water') return 'water';
  if (cat === 'waterway') return 'water';
  if (tag === 'natural=wood' || tag === 'landuse=forest') return 'forest';
  if (cat === 'railway' && type === 'station') return 'transit';
  if (cat === 'aeroway') return 'transit';
  if (cat === 'public_transport' && type === 'station') return 'transit';
  if (cat === 'landuse' && type === 'industrial') return 'industrial';
  if (cat === 'landuse' && type === 'residential') return 'residential';
  if (cat === 'place' && type === 'suburb') return 'residential';
  if (cat === 'place' && (type === 'village' || type === 'hamlet')) return 'rural';
  if (cat === 'landuse' && type === 'farmland') return 'rural';
  if (cat === 'amenity' || cat === 'shop') return 'urban';
  if (cat === 'landuse' && (type === 'commercial' || type === 'retail')) return 'urban';
  if (cat === 'highway') {
    if (['motorway', 'trunk', 'primary'].includes(type)) return 'urban';
    if (['residential', 'footway', 'service', 'tertiary', 'secondary'].includes(type)) return 'residential';
  }
  return 'unknown';
}

export function derivePlaceBundle(r: NominatimResult): {
  placeType: PlaceType;
  place?: { category: string; type: string; name?: string };
  road?: { class: string; name?: string };
  neighborhood?: string;
  city?: string;
} {
  const placeType = derivePlaceType(r);
  const cat = r.class ?? r.category ?? '';
  const type = r.type ?? '';
  const result: ReturnType<typeof derivePlaceBundle> = { placeType };
  if (cat && type) {
    if (cat === 'highway') {
      const road: { class: string; name?: string } = { class: type };
      if (r.name) road.name = r.name;
      result.road = road;
    } else {
      const place: { category: string; type: string; name?: string } = { category: cat, type };
      if (r.name) place.name = r.name;
      result.place = place;
    }
  }
  const addr = r.address ?? {};
  const neighborhood = addr.neighbourhood ?? addr.suburb ?? addr.city_district;
  if (neighborhood) result.neighborhood = neighborhood;
  const city = addr.city ?? addr.town ?? addr.village ?? addr.hamlet;
  if (city) result.city = city;
  return result;
}
