import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, MapPin, Navigation } from 'lucide-react';

import { searchLocations } from '../../utils/nominatim';
import {
  buildDirectionsUrl,
  buildMapsViewUrl,
  isValidLatLng,
  LIGHT_MAP_ATTRIBUTION,
  LIGHT_MAP_TILE_URL,
  SALON_MAP_ZOOM,
} from '../../utils/mapGeo';
import { cn } from '../../utils/cn';
import { Button } from '../common';
import { salonGoldMarkerIcon } from './salonMapMarker';

export interface SalonMapCoords {
  latitude: number;
  longitude: number;
}

interface SalonMapProps {
  latitude?: number | null;
  longitude?: number | null;
  /** Full formatted address shown below the map. */
  address?: string | null;
  /** Optional label used in Maps deep links. */
  salonName?: string | null;
  /** Called when address geocoding resolves missing/invalid coordinates. */
  onCoordinatesResolved?: (coords: SalonMapCoords) => void;
  className?: string;
  mapClassName?: string;
  /** When true, shows a pulse skeleton until ready. */
  loading?: boolean;
}

const MapPaddingView: React.FC<{
  center: [number, number];
  zoom: number;
}> = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    // Symmetric bounds keep the marker at the exact lat/lng while padding
    // the viewport so the pin isn't cramped against the edges.
    const delta = 0.0035;
    const bounds = L.latLngBounds(
      [center[0] - delta, center[1] - delta],
      [center[0] + delta, center[1] + delta]
    );
    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: zoom,
      animate: false,
    });
  }, [center, zoom, map]);

  return null;
};

const MapSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      'overflow-hidden rounded-3xl border border-[var(--color-border-soft)] bg-white shadow-soft',
      className
    )}
    aria-label="Loading map"
    aria-busy="true"
  >
    <div className="relative h-56 w-full animate-pulse bg-gradient-to-br from-[#f3eadb] via-white to-[#f7f0e3] sm:h-64 md:h-72">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-10 w-8 rounded-full bg-[var(--color-brand-gold)]/25" />
      </div>
    </div>
    <div className="space-y-3 border-t border-[var(--color-border-soft)] p-4 sm:p-5">
      <div className="h-3 w-24 animate-pulse rounded-full bg-gradient-to-r from-[#f3eadb] via-white to-[#f3eadb]" />
      <div className="h-4 w-full animate-pulse rounded-full bg-gradient-to-r from-[#f3eadb] via-white to-[#f3eadb]" />
      <div className="h-4 w-3/4 animate-pulse rounded-full bg-gradient-to-r from-[#f3eadb] via-white to-[#f3eadb]" />
      <div className="mt-2 h-10 w-40 animate-pulse rounded-xl bg-gradient-to-r from-[#f3eadb] via-white to-[#f3eadb]" />
    </div>
  </div>
);

const SalonMap: React.FC<SalonMapProps> = ({
  latitude,
  longitude,
  address,
  salonName,
  onCoordinatesResolved,
  className,
  mapClassName,
  loading = false,
}) => {
  const [resolved, setResolved] = useState<SalonMapCoords | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const hasValidStoredCoords = isValidLatLng(latitude, longitude);

  const effectiveCoords = useMemo<SalonMapCoords | null>(() => {
    if (hasValidStoredCoords) {
      return { latitude: latitude as number, longitude: longitude as number };
    }
    return resolved;
  }, [hasValidStoredCoords, latitude, longitude, resolved]);

  const formattedAddress = (address ?? '').trim();

  useEffect(() => {
    setResolved(null);
    setGeocodeError(null);
    setMapReady(false);
  }, [latitude, longitude, formattedAddress]);

  useEffect(() => {
    if (hasValidStoredCoords || !formattedAddress) return;

    let cancelled = false;

    const geocode = async () => {
      setIsGeocoding(true);
      setGeocodeError(null);
      try {
        const places = await searchLocations(formattedAddress, 1);
        if (cancelled) return;
        const place = places[0];
        if (!place || !isValidLatLng(place.lat, place.lon)) {
          setGeocodeError('Unable to locate this address on the map.');
          return;
        }
        const coords = { latitude: place.lat, longitude: place.lon };
        setResolved(coords);
        onCoordinatesResolved?.(coords);
      } catch {
        if (!cancelled) {
          setGeocodeError('Unable to locate this address on the map.');
        }
      } finally {
        if (!cancelled) setIsGeocoding(false);
      }
    };

    void geocode();
    return () => {
      cancelled = true;
    };
  }, [hasValidStoredCoords, formattedAddress, onCoordinatesResolved]);

  if (loading || isGeocoding) {
    return <MapSkeleton className={className} />;
  }

  if (!effectiveCoords) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-3xl border border-[var(--color-border-soft)] bg-white p-5 shadow-soft sm:p-6',
          className
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-gold)]/10">
            <MapPin className="h-5 w-5 text-[var(--color-brand-gold)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Salon location unavailable
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {geocodeError ||
                (formattedAddress
                  ? 'We could not place this address on the map yet.'
                  : 'Set your salon coordinates to show the map and directions.')}
            </p>
            {formattedAddress ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-primary)]">
                {formattedAddress}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const center: [number, number] = [effectiveCoords.latitude, effectiveCoords.longitude];
  const directionsUrl = buildDirectionsUrl(
    effectiveCoords.latitude,
    effectiveCoords.longitude,
    salonName || formattedAddress || undefined
  );
  const mapsViewUrl = buildMapsViewUrl(
    effectiveCoords.latitude,
    effectiveCoords.longitude,
    salonName || formattedAddress || undefined
  );

  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl border border-[var(--color-border-soft)] bg-white shadow-soft',
        className
      )}
    >
      <div
        className={cn(
          'salon-display-map relative h-56 w-full sm:h-64 md:h-72',
          mapClassName
        )}
      >
        {!mapReady && (
          <div
            className="absolute inset-0 z-[500] animate-pulse bg-gradient-to-br from-[#f3eadb] via-white to-[#f7f0e3]"
            aria-hidden
          />
        )}
        <style>{`
          .salon-display-map .leaflet-container {
            height: 100%;
            width: 100%;
            background: var(--color-surface-muted);
            font-family: var(--font-family-sans);
          }
          .salon-display-map .leaflet-control-attribution {
            font-size: 10px;
            background: rgba(253, 251, 247, 0.92);
            color: var(--color-text-tertiary);
          }
          .salon-display-map .salon-map-marker {
            background: transparent;
            border: none;
          }
        `}</style>
        <MapContainer
          center={center}
          zoom={SALON_MAP_ZOOM}
          className="h-full w-full"
          scrollWheelZoom={false}
          touchZoom
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          zoomControl={false}
          attributionControl
          whenReady={() => setMapReady(true)}
        >
          <TileLayer attribution={LIGHT_MAP_ATTRIBUTION} url={LIGHT_MAP_TILE_URL} />
          <MapPaddingView center={center} zoom={SALON_MAP_ZOOM} />
          <Marker position={center} icon={salonGoldMarkerIcon} />
        </MapContainer>
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Address
          </p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--color-text-primary)]">
            {formattedAddress ||
              `${effectiveCoords.latitude.toFixed(5)}, ${effectiveCoords.longitude.toFixed(5)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Navigation className="h-3.5 w-3.5" />}
            onClick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}
          >
            Get Directions
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
            onClick={() => window.open(mapsViewUrl, '_blank', 'noopener,noreferrer')}
          >
            Open in Maps
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SalonMap;
