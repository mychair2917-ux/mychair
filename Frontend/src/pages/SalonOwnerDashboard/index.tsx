import React from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Building2, LogOut, Mail, MapPin, User } from 'lucide-react';

import { Button, Loader } from '../../components/common';
import { ROUTE_PATHS } from '../../constants';
import { logout } from '../../redux/slices/auth/authSlice';
import { useGetSalonOwnerProfileQuery } from '../../redux/slices/salonOwner/salonOwnerApi';

const SalonOwnerDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useGetSalonOwnerProfileQuery();

  const profile = data?.data;

  const handleLogout = () => {
    dispatch(logout());
    navigate(`/${ROUTE_PATHS.SALON_OWNER_LOGIN}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-red-600">Failed to load salon details. Please try logging in again.</p>
      </div>
    );
  }

  const detailItems = [
    { label: 'Salon Name', value: profile.salon_name, icon: Building2 },
    { label: 'Slug', value: profile.slug, icon: Building2 },
    { label: 'Email', value: profile.email, icon: Mail },
    { label: 'Username', value: profile.username, icon: User },
    { label: 'Address', value: profile.address || '—', icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-bg)]">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">MyChair</h1>
            <p className="text-sm text-gray-500">Salon Owner Dashboard</p>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="!text-gray-600">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6 md:p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Welcome, {profile.username}</h2>
          <p className="mt-1 text-gray-500">Your salon details from the invitation</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {detailItems.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-gold)]/10">
                <item.icon className="h-5 w-5 text-[var(--color-brand-gold)]" />
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                  {item.label}
                </p>
                <p className="mt-1 text-base font-semibold text-gray-900">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default SalonOwnerDashboard;
