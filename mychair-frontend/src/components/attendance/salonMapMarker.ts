import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const GOLD_PIN_SVG = `
<svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 2C9.716 2 3 8.716 3 17c0 12.5 15 28 15 28s15-15.5 15-28C33 8.716 26.284 2 18 2z"
        fill="url(#salonGoldPin)" stroke="#a38242" stroke-width="1"/>
  <circle cx="18" cy="17" r="7" fill="white" opacity=".95"/>
  <circle cx="18" cy="17" r="3.5" fill="#c5a059"/>
  <defs>
    <linearGradient id="salonGoldPin" x1="3" y1="2" x2="33" y2="45" gradientUnits="userSpaceOnUse">
      <stop stop-color="#d8ba7d"/><stop offset="1" stop-color="#a38242"/>
    </linearGradient>
  </defs>
</svg>`;

export const salonGoldMarkerIcon = L.divIcon({
  html: GOLD_PIN_SVG,
  className: 'salon-map-marker',
  iconSize: [36, 48],
  iconAnchor: [18, 48],
  popupAnchor: [0, -48],
});
