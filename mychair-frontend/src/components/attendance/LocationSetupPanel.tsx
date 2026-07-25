import React, { useState } from 'react';
import { ExternalLink, Navigation } from 'lucide-react';

import type { NominatimPlace } from '../../utils/nominatim';
import {
  buildDirectionsUrl,
  buildMapsViewUrl,
  isValidLatLng,
} from '../../utils/mapGeo';
import { Button, FormField, Input } from '../common';
import LocationMapPicker from './LocationMapPicker';
import LocationSearchInput from './LocationSearchInput';

interface LocationSetupPanelProps {
  latitude: number;
  longitude: number;
  radius: number;
  searchQuery?: string;
  /** Full formatted address shown under the map. */
  address?: string | null;
  salonName?: string | null;
  onLocationChange: (latitude: number, longitude: number) => void;
  onRadiusChange: (radius: number) => void;
  onSearchQueryChange?: (query: string) => void;
  onAddressChange?: (address: string) => void;
  readOnly?: boolean;
}

const LocationSetupPanel: React.FC<LocationSetupPanelProps> = ({
  latitude,
  longitude,
  radius,
  searchQuery = '',
  address,
  salonName,
  onLocationChange,
  onRadiusChange,
  onSearchQueryChange,
  onAddressChange,
  readOnly = false,
}) => {
  const [query, setQuery] = useState(searchQuery);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onSearchQueryChange?.(value);
  };

  const handlePlaceSelect = (place: NominatimPlace) => {
    onLocationChange(place.lat, place.lon);
    onAddressChange?.(place.display_name);
    setQuery(place.display_name);
    onSearchQueryChange?.(place.display_name);
  };

  const hasValidCoords = isValidLatLng(latitude, longitude);
  const formattedAddress = (address ?? '').trim();
  const directionsUrl = hasValidCoords
    ? buildDirectionsUrl(latitude, longitude, salonName || formattedAddress || undefined)
    : null;
  const mapsViewUrl = hasValidCoords
    ? buildMapsViewUrl(latitude, longitude, salonName || formattedAddress || undefined)
    : null;

  return (
    <div className="space-y-4">
      {!readOnly && (
        <LocationSearchInput
          value={query}
          onChange={handleQueryChange}
          onSelect={handlePlaceSelect}
        />
      )}

      <LocationMapPicker
        latitude={latitude}
        longitude={longitude}
        radius={radius}
        onLocationChange={onLocationChange}
        onRadiusChange={onRadiusChange}
        readOnly={readOnly}
        hideCoordinates
        compact
      />

      {(formattedAddress || hasValidCoords) && (
        <div className="flex flex-col gap-4 rounded-3xl border border-[var(--color-border-soft)] bg-white p-4 shadow-soft sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Address
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--color-text-primary)]">
              {formattedAddress ||
                (hasValidCoords
                  ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                  : '—')}
            </p>
          </div>

          {directionsUrl && mapsViewUrl && (
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
          )}
        </div>
      )}

      <FormField label="Attendance Radius (meters)" name="attendance_radius">
        <Input
          id="attendance_radius"
          type="number"
          min={10}
          max={5000}
          value={radius}
          readOnly={readOnly}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
        />
      </FormField>

      {!readOnly && (
        <p className="text-sm text-gray-500">
          Search for your salon address, then fine-tune on the map preview if needed.
        </p>
      )}
    </div>
  );
};

export default LocationSetupPanel;
