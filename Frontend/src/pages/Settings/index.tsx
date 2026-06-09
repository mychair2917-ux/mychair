import React from 'react';

import AttendanceLocationSettings from '../../components/attendance/AttendanceLocationSettings';

const Settings: React.FC = () => {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage salon preferences and attendance configuration.
        </p>
      </div>

      <AttendanceLocationSettings />
    </div>
  );
};

export default Settings;
