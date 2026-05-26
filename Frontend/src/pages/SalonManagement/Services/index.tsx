import React from 'react';
import { Scissors } from 'lucide-react';

const Services: React.FC = () => {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
          Services
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage salon services, pricing, and categories. Full CRUD coming soon.
        </p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-12 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand-gold)]/10">
            <Scissors className="h-8 w-8 text-[var(--color-brand-gold)]" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Services module</h2>
          <p className="mt-2 max-w-md text-sm text-gray-500">
            This section will let you create and manage service offerings for your salon. Stay
            tuned for updates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Services;
