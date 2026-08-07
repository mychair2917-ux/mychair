import React, { useState } from 'react';
import { Monitor, Laptop, Tablet, Smartphone, CheckCircle2 } from 'lucide-react';

interface DeviceTab {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  image: string;
  badge: string;
}

export const UIPreviewSection: React.FC = () => {
  const devices: DeviceTab[] = [
    {
      id: 'desktop',
      name: 'Desktop POS',
      icon: Monitor,
      description: 'Ultra-clear wide screen layout for front desk receptionists handling heavy appointment queues and rapid billing.',
      image: '/images/landing/salon-pos-reception.jpg',
      badge: '4K Desktop Optimization',
    },
    {
      id: 'laptop',
      name: 'Laptop View',
      icon: Laptop,
      description: 'Full-featured operational dashboard for salon owners & managers working at desk or remote.',
      image: '/images/landing/salon-multi-staff.jpg',
      badge: 'Full Mac & Windows Support',
    },
    {
      id: 'tablet',
      name: 'Tablet Experience',
      icon: Tablet,
      description: 'Touch-optimized responsive UI for floor managers and stylists walking around the salon floor.',
      image: '/images/landing/salon-tablet-manager.jpg',
      badge: 'iPad & Android Tablet Native',
    },
    {
      id: 'phone',
      name: 'Mobile Access',
      icon: Smartphone,
      description: 'Compact mobile dashboard for instant revenue checks, emergency bookings, and staff notifications on the go.',
      image: '/images/landing/salon-hero-collage.jpg',
      badge: 'Mobile Browser Ready',
    },
  ];

  const [activeDeviceId, setActiveDeviceId] = useState('desktop');
  const activeDevice = devices.find((d) => d.id === activeDeviceId) || devices[0];

  return (
    <section id="devices" className="py-20 md:py-28 bg-slate-50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-sky-50 border border-sky-100 text-sky-700 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
            Multi-Device Experience
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            One Unified Interface Across All Devices
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Whether on a 32-inch reception monitor, laptop, tablet, or smartphone — MyChair looks and feels extraordinary.
          </p>
        </div>

        {/* Device Switcher Tabs */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10 overflow-x-auto pb-2">
          {devices.map((device) => {
            const Icon = device.icon;
            const isActive = device.id === activeDeviceId;
            return (
              <button
                key={device.id}
                onClick={() => setActiveDeviceId(device.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 border ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                <span>{device.name}</span>
              </button>
            );
          })}
        </div>

        {/* Active Device Preview Box */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-6 sm:p-8 lg:p-12">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Device Info Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                  {activeDevice.badge}
                </span>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                  {activeDevice.name}
                </h3>
              </div>
              <p className="text-slate-600 text-sm max-w-lg">
                {activeDevice.description}
              </p>
            </div>

            {/* Frame Container */}
            <div className="relative rounded-2xl border border-slate-300 bg-slate-900 overflow-hidden shadow-xl p-2">
              <img
                src={activeDevice.image}
                alt={activeDevice.name}
                className="w-full h-72 sm:h-[450px] object-cover rounded-xl"
              />

              {/* Status bar mock */}
              <div className="absolute top-4 right-4 bg-slate-900/90 text-white text-xs font-medium px-3 py-1 rounded-full backdrop-blur-md border border-slate-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Responsive View</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
