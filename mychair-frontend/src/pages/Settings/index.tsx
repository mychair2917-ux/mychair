import React from 'react';

import AttendanceLocationSettings from '../../components/attendance/AttendanceLocationSettings';
import { MembershipSettingsComponent } from '../../components/membership/MembershipSettingsComponent';

const Settings: React.FC = () => {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage salon preferences, membership duration settings, and attendance configuration.
        </p>
      </div>

      <MembershipSettingsComponent />

      <AttendanceLocationSettings />
    </div>
  );
};

export default Settings;
