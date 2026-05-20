import React from 'react';

const Profile: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Profile</h1>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <p className="text-gray-600">User profile details go here.</p>
      </div>
    </div>
  );
};

export default Profile;
