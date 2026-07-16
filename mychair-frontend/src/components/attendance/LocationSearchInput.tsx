import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';

import { searchLocations, type NominatimPlace } from '../../utils/nominatim';
import { cn } from '../../utils/cn';
import { FormField, Input } from '../common';

interface LocationSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: NominatimPlace) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
  value,
  onChange,
  onSelect,
  label = 'Search Location',
  placeholder = 'Search salon address, area, landmark, or city',
  disabled = false,
}) => {
  const [suggestions, setSuggestions] = useState<NominatimPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(value, 5);
        setSuggestions(results);
        if (results.length === 0) {
          setSearchError(
            'No matching locations found. Try searching with a nearby landmark or area name.'
          );
        } else {
          setSearchError(null);
        }
        setIsOpen(results.length > 0);
      } catch {
        setSuggestions([]);
        setSearchError(
          'No matching locations found. Try searching with a nearby landmark or area name.'
        );
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleSelect = (place: NominatimPlace) => {
    onChange(place.display_name);
    onSelect(place);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <FormField label={label} name="location_search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          {isSearching && (
            <span className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent" />
          )}
          <Input
            id="location_search"
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => {
              onChange(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            className="pl-10"
            autoComplete="off"
          />
        </div>
      </FormField>

      {searchError && (
        <p className="mt-1 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {searchError}
        </p>
      )}

      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        Start typing your salon location and select the correct suggestion from the list.
      </p>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-lg">
          <div className="border-b border-[var(--color-border-soft)] px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Suggested Locations
            </span>
          </div>
          <ul className="max-h-64 overflow-y-auto">
          {suggestions.map((place) => (
            <li key={place.place_id}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-start gap-2 px-4 py-3 text-left text-sm text-gray-700',
                  'hover:bg-[var(--color-surface-muted)]'
                )}
                onClick={() => handleSelect(place)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-gold)]" />
                <span className="line-clamp-2">{place.display_name}</span>
              </button>
            </li>
          ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LocationSearchInput;
