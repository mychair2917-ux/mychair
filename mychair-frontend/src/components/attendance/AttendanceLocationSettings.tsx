import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const location = data?.data;
    if (!location) return;
    if (location.latitude != null) setLatitude(location.latitude);
    if (location.longitude != null) setLongitude(location.longitude);
    setRadius(location.attendance_radius || 100);
    setShiftStart(location.shift_start || '09:00');
  }, [data]);

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

  return (
    <CommonCard
      title="Attendance Location"
      subtitle="Set salon coordinates and attendance radius for staff check-ins"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleUseCurrentLocation}>
            Use My Location
          </Button>
          <Button isLoading={isSaving} onClick={handleSave}>
            Save Location
          </Button>
        </div>
      }
      loading={isLoading}
    >
      <div className="space-y-4 p-5">
        <FormField label="Shift Start (HH:MM)" name="shift_start">
          <Input
            id="shift_start"
            value={shiftStart}
            onChange={(event) => setShiftStart(event.target.value)}
            placeholder="09:00"
          />
        </FormField>
        <LocationSetupPanel
          latitude={latitude}
          longitude={longitude}
          radius={radius}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onLocationChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
          onRadiusChange={setRadius}
        />
      </div>
    </CommonCard>
  );
};

export default AttendanceLocationSettings;
