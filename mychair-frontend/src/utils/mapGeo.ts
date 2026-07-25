/** Shared salon map helpers — never offset or approximate stored coordinates. */

/** Default zoom: enough context for nearby roads without feeling cramped. */
export const SALON_MAP_ZOOM = 15;

/** Slightly tighter zoom used when confirming a pin during setup. */
export const SALON_MAP_CONFIRM_ZOOM = 16;

export interface LatLng {
  latitude: number;
  longitude: number;
}

export const isValidLatitude = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;

export const isValidLongitude = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;

export const isValidLatLng = (
  latitude: unknown,
  longitude: unknown
): latitude is number => isValidLatitude(latitude) && isValidLongitude(longitude);

export const formatLatLng = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

/** Open turn-by-turn directions in Google Maps (works on web + mobile apps). */
export const buildDirectionsUrl = (latitude: number, longitude: number, label?: string): string => {
  const destination = label?.trim()
    ? encodeURIComponent(`${label.trim()}@${latitude},${longitude}`)
    : `${latitude},${longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
};

/** Open the place in Google Maps (view, not directions). */
export const buildMapsViewUrl = (latitude: number, longitude: number, label?: string): string => {
  const query = label?.trim()
    ? encodeURIComponent(label.trim())
    : `${latitude},${longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

/** Light basemap that matches the app's cream/white surfaces. */
export const LIGHT_MAP_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

export const LIGHT_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
