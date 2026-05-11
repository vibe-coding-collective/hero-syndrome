interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  state?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
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

export interface PlaceBundle {
  place?: { category: string; type: string; name?: string };
  road?: { class: string; name?: string };
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  postcode?: string;
}

/** Parse Nominatim reverse-geocode response into the raw fields the Claude
 *  location-classification step consumes. The classifier turns these (plus
 *  nearby POIs) into one of the 50 `LocationType` ids. */
export function derivePlaceBundle(r: NominatimResult): PlaceBundle {
  const cat = r.class ?? r.category ?? '';
  const type = r.type ?? '';
  const result: PlaceBundle = {};
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
  if (addr.state) result.state = addr.state;
  if (addr.country) result.country = addr.country;
  if (addr.country_code) result.countryCode = addr.country_code.toUpperCase();
  if (addr.postcode) result.postcode = addr.postcode;
  return result;
}
