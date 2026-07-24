import React, { useState } from 'react';

import type { NominatimPlace } from '../../utils/nominatim';
import { FormField, Input } from '../common';
import LocationMapPicker from './LocationMapPicker';
import LocationSearchInput from './LocationSearchInput';

interface LocationSetupPanelProps {
  latitude: number;
  longitude: number;
  radius: number;
  searchQuery?: string;
  onLocationChange: (latitude: number, longitude: number) => void;
  onRadiusChange: (radius: number) => void;
  onSearchQueryChange?: (query: string) => void;
  readOnly?: boolean;
}

const LocationSetupPanel: React.FC<LocationSetupPanelProps> = ({
  latitude,
  longitude,
  radius,
  searchQuery = '',
  onLocationChange,
  onRadiusChange,
  onSearchQueryChange,
  readOnly = false,
}) => {
  const [query, setQuery] = useState(searchQuery);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onSearchQueryChange?.(value);
  };

  const handlePlaceSelect = (place: NominatimPlace) => {
    onLocationChange(place.lat, place.lon);
  };

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
