import React, { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { FormField, Input } from '../common';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

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

const MapRecenter: React.FC<{ latitude: number; longitude: number }> = ({
  latitude,
  longitude,
}) => {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom());
  }, [latitude, longitude, map]);
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
  const center = useMemo<[number, number]>(() => [latitude, longitude], [latitude, longitude]);

  return (
    <div className="space-y-4">
      <div
        className={`overflow-hidden rounded-2xl border border-[var(--color-border-soft)] ${
          compact ? 'h-48' : 'h-72'
        }`}
      >
        <MapContainer center={center} zoom={17} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapRecenter latitude={latitude} longitude={longitude} />
          <MapClickHandler onLocationChange={onLocationChange} readOnly={readOnly} />
          <Marker position={center} />
          <Circle
            center={center}
            radius={radius}
            pathOptions={{ color: '#c9a227', fillColor: '#c9a227', fillOpacity: 0.15 }}
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
