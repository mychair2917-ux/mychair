import React, { useEffect, useState } from 'react';
import { Clock, Navigation, Save } from 'lucide-react';
import { useSelector } from 'react-redux';

import {
  useGetBranchLocationQuery,
  useUpdateBranchLocationMutation,
} from '../../redux/slices/attendance/attendanceApi';
import { ROLES } from '../../constants';
import { normalizeRole } from '../../config/rbac';
import type { RootState } from '../../redux/store';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { getCurrentPosition } from '../../utils/geolocation';
import { isValidLatLng } from '../../utils/mapGeo';
import { searchLocations } from '../../utils/nominatim';
import { Button, CommonCard, FormField, Input, showToast } from '../common';
import LocationSetupPanel from './LocationSetupPanel';

const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.209;

const AttendanceLocationSettings: React.FC = () => {
  const role = useSelector((state: RootState) => state.auth.user?.role);
  const normalizedRole = normalizeRole(role);
  const canEdit =
    normalizedRole === ROLES.SUPER_ADMIN ||
    normalizedRole === ROLES.SALON_OWNER ||
    normalizedRole === ROLES.SALON_ADMIN;

  const { data, isLoading, refetch } = useGetBranchLocationQuery(undefined, {
    skip: !canEdit,
  });
  const [updateLocation, { isLoading: isSaving }] = useUpdateBranchLocationMutation();

  const [latitude, setLatitude] = useState(DEFAULT_LAT);
  const [longitude, setLongitude] = useState(DEFAULT_LNG);
  const [radius, setRadius] = useState(100);
  const [shiftStart, setShiftStart] = useState('09:00');
  const [searchQuery, setSearchQuery] = useState('');
  const [address, setAddress] = useState('');
  const [isResolvingCoords, setIsResolvingCoords] = useState(false);

  useEffect(() => {
    const location = data?.data;
    if (!location) return;
    if (location.latitude != null) setLatitude(location.latitude);
    if (location.longitude != null) setLongitude(location.longitude);
    setRadius(location.attendance_radius || 100);
    setShiftStart(location.shift_start || '09:00');
    setAddress(location.address || '');
  }, [data]);

  // Geocode saved address once when stored coordinates are missing/invalid, then persist.
  useEffect(() => {
    const location = data?.data;
    if (!location) return;
    if (isValidLatLng(location.latitude, location.longitude)) return;

    const savedAddress = (location.address || '').trim();
    if (!savedAddress) return;

    let cancelled = false;

    const resolveFromAddress = async () => {
      setIsResolvingCoords(true);
      try {
        const places = await searchLocations(savedAddress, 1);
        if (cancelled) return;
        const place = places[0];
        if (!place || !isValidLatLng(place.lat, place.lon)) return;

        setLatitude(place.lat);
        setLongitude(place.lon);

        await updateLocation({
          latitude: place.lat,
          longitude: place.lon,
          attendance_radius: location.attendance_radius || 100,
          shift_start: location.shift_start || '09:00',
        }).unwrap();
        if (!cancelled) refetch();
      } catch {
        // User can still set location manually via search.
      } finally {
        if (!cancelled) setIsResolvingCoords(false);
      }
    };

    void resolveFromAddress();
    return () => {
      cancelled = true;
    };
  }, [data, updateLocation, refetch]);

  const handleUseCurrentLocation = async () => {
    try {
      const position = await getCurrentPosition();
      setLatitude(position.latitude);
      setLongitude(position.longitude);
      showToast('success', 'Current location applied');
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Location permission required'));
    }
  };

  const handleSave = async () => {
    if (!isValidLatLng(latitude, longitude)) {
      showToast('error', 'Enter a valid latitude and longitude');
      return;
    }
    try {
      await updateLocation({
        latitude,
        longitude,
        attendance_radius: radius,
        shift_start: shiftStart,
      }).unwrap();
      showToast('success', 'Attendance location saved');
      refetch();
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Unable to save location'));
    }
  };

  if (!canEdit) {
    return null;
  }

  const location = data?.data;

  return (
    <CommonCard
      title="Salon GPS & Geofence Settings"
      subtitle="Set salon coordinates and allowable check-in radius for staff attendance validation"
      className="border border-gray-200/80 shadow-xs rounded-2xl"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={handleUseCurrentLocation}
            leftIcon={<Navigation className="h-4 w-4" />}
            className="rounded-xl font-semibold"
          >
            Use My GPS Location
          </Button>
          <Button
            isLoading={isSaving}
            onClick={handleSave}
            leftIcon={<Save className="h-4 w-4" />}
            className="rounded-xl font-semibold"
          >
            Save Settings
          </Button>
        </div>
      }
      loading={isLoading || isResolvingCoords}
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <FormField label="Standard Shift Start Time (HH:MM)" name="shift_start">
            <div className="relative max-w-xs">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="shift_start"
                type="time"
                value={shiftStart}
                onChange={(event) => setShiftStart(event.target.value)}
                placeholder="09:00"
                className="pl-9.5 rounded-xl border-gray-200 bg-white"
              />
            </div>
          </FormField>
        </div>

        <LocationSetupPanel
          latitude={latitude}
          longitude={longitude}
          radius={radius}
          address={address}
          salonName={location?.branch_name}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onLocationChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
          onRadiusChange={setRadius}
          onAddressChange={setAddress}
        />
      </div>
    </CommonCard>
  );
};

export default AttendanceLocationSettings;
