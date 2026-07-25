import React, { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  isValidLatLng,
  LIGHT_MAP_ATTRIBUTION,
  LIGHT_MAP_TILE_URL,
  SALON_MAP_ZOOM,
} from '../../utils/mapGeo';
import { FormField, Input } from '../common';
import { salonGoldMarkerIcon } from './salonMapMarker';

interface LocationMapPickerProps {
  latitude: number;
  longitude: number;
  radius: number;
  onLocationChange: (latitude: number, longitude: number) => void;
  onRadiusChange: (radius: number) => void;
  readOnly?: boolean;
  hideCoordinates?: boolean;
  compact?: boolean;
}

const MapClickHandler: React.FC<{
  onLocationChange: (latitude: number, longitude: number) => void;
  readOnly?: boolean;
}> = ({ onLocationChange, readOnly }) => {
  useMapEvents({
    click(event) {
      if (readOnly) return;
      onLocationChange(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

const MapPaddingView: React.FC<{
  latitude: number;
  longitude: number;
  zoom: number;
}> = ({ latitude, longitude, zoom }) => {
  const map = useMap();

  useEffect(() => {
    if (!isValidLatLng(latitude, longitude)) return;
    const delta = 0.0035;
    const bounds = L.latLngBounds(
      [latitude - delta, longitude - delta],
      [latitude + delta, longitude + delta]
    );
    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: zoom,
      animate: false,
    });
  }, [latitude, longitude, zoom, map]);

  return null;
};

const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  latitude,
  longitude,
  radius,
  onLocationChange,
  onRadiusChange,
  readOnly = false,
  hideCoordinates = false,
  compact = false,
}) => {
  const [mapReady, setMapReady] = useState(false);
  const center = useMemo<[number, number]>(() => {
    if (isValidLatLng(latitude, longitude)) return [latitude, longitude];
    return [28.6139, 77.209];
  }, [latitude, longitude]);

  return (
    <div className="space-y-4">
      <div
        className={`location-map-picker relative overflow-hidden rounded-3xl border border-[var(--color-border-soft)] shadow-soft ${
          compact ? 'h-52 sm:h-56 md:h-64' : 'h-64 sm:h-72 md:h-80'
        }`}
      >
        {!mapReady && (
          <div
            className="absolute inset-0 z-[500] animate-pulse bg-gradient-to-br from-[#f3eadb] via-white to-[#f7f0e3]"
            aria-label="Loading map"
            aria-busy="true"
          />
        )}
        <style>{`
          .location-map-picker .leaflet-container {
            height: 100%;
            width: 100%;
            background: var(--color-surface-muted);
          }
          .location-map-picker .leaflet-control-attribution {
            font-size: 10px;
            background: rgba(253, 251, 247, 0.92);
            color: var(--color-text-tertiary);
          }
          .location-map-picker .salon-map-marker {
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
          doubleClickZoom={!readOnly}
          boxZoom={false}
          zoomControl={false}
          whenReady={() => setMapReady(true)}
        >
          <TileLayer attribution={LIGHT_MAP_ATTRIBUTION} url={LIGHT_MAP_TILE_URL} />
          <MapPaddingView latitude={center[0]} longitude={center[1]} zoom={SALON_MAP_ZOOM} />
          <MapClickHandler onLocationChange={onLocationChange} readOnly={readOnly} />
          <Marker position={center} icon={salonGoldMarkerIcon} />
          <Circle
            center={center}
            radius={radius}
            pathOptions={{ color: '#c5a059', fillColor: '#c5a059', fillOpacity: 0.12 }}
          />
        </MapContainer>
      </div>

      {!compact && (
        <div className={`grid gap-4 ${hideCoordinates ? 'sm:grid-cols-1' : 'sm:grid-cols-3'}`}>
          {!hideCoordinates && (
            <>
              <FormField label="Latitude" name="latitude">
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  readOnly={readOnly}
                  onChange={(event) => onLocationChange(Number(event.target.value), longitude)}
                />
              </FormField>
              <FormField label="Longitude" name="longitude">
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  readOnly={readOnly}
                  onChange={(event) => onLocationChange(latitude, Number(event.target.value))}
                />
              </FormField>
            </>
          )}
          <FormField label="Radius (meters)" name="radius">
            <Input
              id="radius"
              type="number"
              min={10}
              max={5000}
              value={radius}
              readOnly={readOnly}
              onChange={(event) => onRadiusChange(Number(event.target.value))}
            />
          </FormField>
        </div>
      )}

      {!readOnly && !compact && (
        <p className="text-sm text-gray-500">Tap on the map to set the salon attendance location.</p>
      )}
    </div>
  );
};

export default LocationMapPicker;
