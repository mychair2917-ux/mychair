export interface NominatimAddressFields {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: number;
  lon: number;
  address?: NominatimAddressFields;
}

export interface ReverseGeocodedAddress {
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

interface NominatimRawResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddressFields;
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

let lastRequestAt = 0;

const throttle = async (): Promise<void> => {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
  }
  lastRequestAt = Date.now();
};

export const searchLocations = async (query: string, limit = 8): Promise<NominatimPlace[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  await throttle();

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
  });

  const response = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
    // Nominatim requires a valid User-Agent; browsers may block custom UA on cross-origin.
    // Use a descriptive referrer via the app name in the query when possible.
  });

  if (!response.ok) {
    throw new Error('Unable to search locations. Please try again.');
  }

  const results = (await response.json()) as NominatimRawResult[];
  return results.map((item) => ({
    place_id: item.place_id,
    display_name: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
    address: item.address,
  }));
};

export const reverseGeocode = async (
  lat: number,
  lon: number
): Promise<ReverseGeocodedAddress> => {
  await throttle();

  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: 'json',
    addressdetails: '1',
  });

  const response = await fetch(`${NOMINATIM_REVERSE}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to reverse geocode. Please try again.');
  }

  const result = (await response.json()) as {
    display_name?: string;
    address?: NominatimAddressFields;
  };
  const addr = result.address ?? {};

  return {
    address:
      [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(', ') ||
      result.display_name ||
      '',
    city: addr.city || addr.town || addr.village || addr.county || '',
    state: addr.state || addr.state_district || '',
    pincode: addr.postcode || '',
    latitude: lat,
    longitude: lon,
  };
};

export const extractAddress = (place: NominatimPlace): ReverseGeocodedAddress => {
  const addr = place.address ?? {};
  return {
    address:
      [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(', ') ||
      place.display_name,
    city: addr.city || addr.town || addr.village || addr.county || '',
    state: addr.state || addr.state_district || '',
    pincode: addr.postcode || '',
    latitude: place.lat,
    longitude: place.lon,
  };
};
