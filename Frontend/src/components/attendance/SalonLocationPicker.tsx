import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Check,
  ChevronRight,
  GripVertical,
  Loader2,
  MapPin,
  Navigation,
  Search,
} from 'lucide-react';

import {
  extractAddress,
  reverseGeocode,
  searchLocations,
  type NominatimPlace,
  type ReverseGeocodedAddress,
} from '../../utils/nominatim';
import { getCurrentPosition } from '../../utils/geolocation';
import { cn } from '../../utils/cn';
import { Button, showToast } from '../common';

/* ── Leaflet icon fix ────────────────────────────────────────────── */
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/* ── Custom gold marker icon ─────────────────────────────────────── */
const GOLD_PIN_SVG = `
<svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 2C9.716 2 3 8.716 3 17c0 12.5 15 28 15 28s15-15.5 15-28C33 8.716 26.284 2 18 2z"
        fill="url(#gld)" stroke="#a38242" stroke-width="1"/>
  <circle cx="18" cy="17" r="7" fill="white" opacity=".95"/>
  <circle cx="18" cy="17" r="3.5" fill="#c5a059"/>
  <defs>
    <linearGradient id="gld" x1="3" y1="2" x2="33" y2="45" gradientUnits="userSpaceOnUse">
      <stop stop-color="#d8ba7d"/><stop offset="1" stop-color="#a38242"/>
    </linearGradient>
  </defs>
</svg>`;

const goldMarkerIcon = L.divIcon({
  html: GOLD_PIN_SVG,
  className: '',
  iconSize: [36, 48],
  iconAnchor: [18, 48],
  popupAnchor: [0, -48],
});

/* ── Types ────────────────────────────────────────────────────────── */
export interface SalonLocation {
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

interface SalonLocationPickerProps {
  onConfirm: (location: SalonLocation) => void;
  onCancel?: () => void;
  initialLocation?: { latitude: number; longitude: number };
  /** Strip outer card chrome when nested inside a modal or form. */
  embedded?: boolean;
  /** Skip the success screen — parent handles post-confirm flow. */
  skipDoneStep?: boolean;
}

type PickerStep = 'search' | 'confirm' | 'done';

const STEPS: { key: PickerStep; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'confirm', label: 'Confirm' },
  { key: 'done', label: 'Done' },
];

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

/* ── Subcomponents ────────────────────────────────────────────────── */

/** Step indicator dots */
const StepIndicator: React.FC<{ current: PickerStep }> = ({ current }) => {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-1 py-4">
      {STEPS.map((step, i) => {
        const isCompleted = i < idx;
        const isActive = i === idx;
        return (
          <React.Fragment key={step.key}>
            {i > 0 && (
              <div
                className={cn(
                  'h-0.5 w-8 rounded-full transition-colors duration-500',
                  isCompleted ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border-soft)]'
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-500',
                  isCompleted &&
                    'bg-[var(--color-brand-gold)] text-white shadow-md shadow-[rgba(197,160,89,0.3)]',
                  isActive &&
                    'border-2 border-[var(--color-brand-gold)] bg-white text-[var(--color-brand-gold)] shadow-md shadow-[rgba(197,160,89,0.15)]',
                  !isCompleted && !isActive && 'border border-[var(--color-border-soft)] bg-white text-gray-400'
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium transition-colors',
                  isActive ? 'text-[var(--color-brand-gold-dark)]' : 'text-gray-400'
                )}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Controls the map view */
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({
  center,
  zoom,
}) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
};

/** Read-only address field */
const AddressField: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  delay?: number;
}> = ({ label, value, icon, delay = 0 }) => (
  <div
    className="animate-[fadeSlideUp_0.4s_ease_both] rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-4 py-3"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-center gap-1.5">
      {icon && <span className="text-[var(--color-brand-gold)]">{icon}</span>}
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {label}
      </span>
    </div>
    <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)] leading-snug">
      {value || '—'}
    </p>
  </div>
);

/* ── Main component ───────────────────────────────────────────────── */
const SalonLocationPicker: React.FC<SalonLocationPickerProps> = ({
  onConfirm,
  onCancel,
  initialLocation,
  embedded = false,
  skipDoneStep = false,
}) => {
  /* State */
  const [step, setStep] = useState<PickerStep>('search');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [location, setLocation] = useState<ReverseGeocodedAddress | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    initialLocation
      ? [initialLocation.latitude, initialLocation.longitude]
      : INDIA_CENTER
  );
  const [mapZoom, setMapZoom] = useState(initialLocation ? 17 : 5);

  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  /* Refs */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  /* Debounced search (300ms per spec) */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(query, 5);
        setSuggestions(results);
        if (results.length === 0) {
          setSearchError('No matching locations found. Try searching with a nearby landmark or area name.');
        }
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setSearchError('No matching locations found. Try searching with a nearby landmark or area name.');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  /* Handle suggestion selection */
  const handleSelect = useCallback((place: NominatimPlace) => {
    const addr = extractAddress(place);
    setLocation(addr);
    setMapCenter([place.lat, place.lon]);
    setMapZoom(17);
    setQuery(place.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    setStep('confirm');
    showToast('success', 'Location selected successfully');
  }, []);

  /* Handle pin drag */
  const handlePinDrag = useCallback(async (lat: number, lng: number) => {
    setMapCenter([lat, lng]);
    setIsReverseGeocoding(true);
    try {
      const addr = await reverseGeocode(lat, lng);
      setLocation(addr);
    } catch {
      showToast('error', 'Unable to update address. Coordinates saved.');
      if (location) {
        setLocation({ ...location, latitude: lat, longitude: lng });
      }
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [location]);

  /* Handle current location */
  const handleUseCurrentLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      const pos = await getCurrentPosition();
      setMapCenter([pos.latitude, pos.longitude]);
      setMapZoom(17);

      setIsReverseGeocoding(true);
      try {
        const addr = await reverseGeocode(pos.latitude, pos.longitude);
        setLocation(addr);
        setQuery(addr.address);
        setStep('confirm');
        showToast('success', 'Location selected successfully');
      } catch {
        setLocation({
          address: '',
          city: '',
          state: '',
          pincode: '',
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
        setStep('confirm');
      } finally {
        setIsReverseGeocoding(false);
      }
    } catch {
      showToast('error', 'Unable to detect your current location. Please search manually.');
    } finally {
      setIsLocating(false);
    }
  }, []);

  /* Handle confirm */
  const handleConfirm = useCallback(() => {
    if (!location) {
      showToast('error', 'Please select a valid salon location.');
      return;
    }
    if (!skipDoneStep) {
      setStep('done');
    }
    showToast('success', 'Salon location confirmed successfully.');
    onConfirm({
      address: location.address,
      city: location.city,
      state: location.state,
      pincode: location.pincode,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }, [location, onConfirm, skipDoneStep]);

  /* Marker event handlers */
  const markerEvents = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const { lat, lng } = marker.getLatLng();
          handlePinDrag(lat, lng);
        }
      },
    }),
    [handlePinDrag]
  );

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className={cn('mx-auto w-full', embedded ? '' : 'max-w-2xl')}>
      {/* Inline keyframe animations */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes successPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(197,160,89,0.4); }
          50%      { box-shadow: 0 0 0 18px rgba(197,160,89,0); }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 24; }
          to   { stroke-dashoffset: 0; }
        }
        .salon-picker-map .leaflet-container { border-radius: 16px; }
      `}</style>

      {/* Card wrapper */}
      <div
        className={cn(
          embedded
            ? 'space-y-5'
            : 'overflow-hidden rounded-3xl border border-[var(--color-border-soft)] bg-white shadow-card'
        )}
      >
        {/* Header */}
        {!embedded && (
          <div className="relative overflow-hidden border-b border-[var(--color-border-soft)] px-6 pb-2 pt-6">
            <div className="absolute inset-0 bg-gradient-to-br from-[rgba(197,160,89,0.06)] to-transparent" />
            <div className="relative">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                Salon Location
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                Search and confirm your salon&apos;s exact location for accurate billing, reports,
                staff attendance, and customer navigation.
              </p>
            </div>
            <StepIndicator current={step} />
          </div>
        )}

        {embedded && (
          <>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Salon Location</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                Search and confirm your salon&apos;s exact location for accurate billing, reports,
                staff attendance, and customer navigation.
              </p>
            </div>
            <StepIndicator current={step} />
          </>
        )}

        {/* Body */}
        <div className={cn('space-y-5', !embedded && 'p-6')}>
          {/* ── STEP 1: Search ─────────────────────────────────────── */}
          {step === 'search' && (
            <div className="animate-[fadeSlideUp_0.35s_ease_both] space-y-4">
              {/* Search input */}
              <div ref={dropdownRef} className="relative">
                <label
                  htmlFor="salon_location_search"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  Search Location
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  {isSearching && (
                    <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-brand-gold)]" />
                  )}
                  <input
                    id="salon_location_search"
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    placeholder="Search salon address, area, landmark, or city"
                    autoComplete="off"
                    className={cn(
                      'w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]',
                      'py-3 pl-11 pr-10 text-sm text-[var(--color-text-primary)]',
                      'placeholder:text-gray-400',
                      'transition-all duration-200',
                      'focus:border-[var(--color-brand-gold)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(197,160,89,0.2)]'
                    )}
                  />
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 mt-2 w-full animate-[fadeSlideUp_0.2s_ease_both] overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-lg">
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
                              'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150',
                              'hover:bg-[var(--color-surface-muted)]'
                            )}
                            onClick={() => handleSelect(place)}
                          >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-gold)]" />
                            <span className="line-clamp-2 text-sm text-[var(--color-text-primary)]">
                              {place.display_name}
                            </span>
                            <ChevronRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Search error */}
              {searchError && (
                <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {searchError}
                </p>
              )}

              {/* Helper text */}
              <p className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                Start typing your salon location and select the correct suggestion from the list.
                <br />
                <span className="text-[var(--color-text-secondary)]">
                  e.g. Baner Pune · Phoenix Mall Pune · MG Road Bengaluru
                </span>
              </p>

              {/* Divider with "or" */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--color-border-soft)]" />
                <span className="text-xs font-medium text-gray-400">or</span>
                <div className="h-px flex-1 bg-[var(--color-border-soft)]" />
              </div>

              {/* Current location button */}
              <Button
                variant="secondary"
                fullWidth
                isLoading={isLocating}
                loadingText="Detecting location…"
                leftIcon={<Navigation className="h-4 w-4" />}
                onClick={handleUseCurrentLocation}
              >
                Use Current Location
              </Button>
            </div>
          )}

          {/* ── STEP 2: Confirm ────────────────────────────────────── */}
          {step === 'confirm' && location && (
            <div className="animate-[fadeSlideUp_0.35s_ease_both] space-y-5">
              {/* Map section */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Confirm Salon Location
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                      We&apos;ve automatically placed the pin based on your selected address.
                    </p>
                  </div>
                  {isReverseGeocoding && (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-gold)]" />
                  )}
                </div>

                <div className="salon-picker-map overflow-hidden rounded-2xl border border-[var(--color-border-soft)] shadow-soft">
                  <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    className="h-64 w-full sm:h-72"
                    scrollWheelZoom
                    zoomControl={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapController center={mapCenter} zoom={mapZoom} />
                    <Marker
                      position={mapCenter}
                      icon={goldMarkerIcon}
                      draggable={isAdjusting}
                      ref={markerRef}
                      eventHandlers={markerEvents}
                    />
                  </MapContainer>
                </div>

                {/* Adjust pin toggle */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setIsAdjusting((v) => !v)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200',
                      isAdjusting
                        ? 'bg-[var(--color-brand-gold)] text-white shadow-md shadow-[rgba(197,160,89,0.25)]'
                        : 'border border-[var(--color-border-soft)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)]'
                    )}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                    {isAdjusting ? 'Drag the pin now' : 'Adjust Pin Location'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('search');
                      setLocation(null);
                      setQuery('');
                      setMapZoom(5);
                      setMapCenter(INDIA_CENTER);
                    }}
                    className="text-xs font-medium text-[var(--color-text-tertiary)] underline underline-offset-2 hover:text-[var(--color-text-secondary)]"
                  >
                    Search again
                  </button>
                </div>

                {isAdjusting && (
                  <p className="mt-2 animate-[fadeSlideUp_0.25s_ease_both] rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Drag the pin slightly if your salon is inside a mall, complex, or commercial
                    building.
                  </p>
                )}
              </div>

              {/* Address fields */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Address Details
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <AddressField label="Address" value={location.address} delay={0} />
                  </div>
                  <AddressField label="City" value={location.city} delay={60} />
                  <AddressField label="State" value={location.state} delay={120} />
                  <AddressField label="Pincode" value={location.pincode} delay={180} />
                  <AddressField
                    label="Coordinates"
                    value={`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}
                    delay={240}
                  />
                </div>
              </div>

              {/* Confirm button */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleConfirm}
                rightIcon={<ChevronRight className="h-4 w-4" />}
                className="mt-2 py-3 text-base shadow-lg shadow-[rgba(197,160,89,0.25)]"
              >
                Confirm Location
              </Button>
            </div>
          )}

          {/* ── STEP 3: Done ───────────────────────────────────────── */}
          {step === 'done' && !skipDoneStep && (
            <div className="flex flex-col items-center gap-4 py-8 animate-[scaleIn_0.4s_ease_both]">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand-gold)]"
                style={{ animation: 'successPulse 1.8s ease infinite' }}
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path
                    d="M6 14.5L11.5 20L22 8"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 24,
                      animation: 'checkDraw 0.6s ease 0.3s both',
                    }}
                  />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Salon location confirmed successfully
                </h3>
                {location && (
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {location.city}
                    {location.state ? `, ${location.state}` : ''}
                  </p>
                )}
              </div>
              {onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Continue Setup
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalonLocationPicker;
