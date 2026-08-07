import React from 'react';
import { Check } from 'lucide-react';

interface LifestyleCard {
  title: string;
  role: string;
  description: string;
  image: string;
  badge: string;
}

export const ProductExperienceSection: React.FC = () => {
  const experiences: LifestyleCard[] = [
    {
      title: 'Effortless Reception & Billing',
      role: 'Receptionist & Front Desk',
      description:
        'Receptionists welcome clients with warmth while quickly handling appointment scheduling, chair assignments, and instantaneous checkout billing on desktop monitors.',
      image: '/images/landing/salon-luxury-reception.jpg',
      badge: 'Reception Desk',
    },
    {
      title: 'Real-Time Owner & Business Control',
      role: 'Salon Owner & Operations Manager',
      description:
        'Owners review live branch performance, daily cash inflow, attendance trends, and inventory levels anytime from their tablet or laptop.',
      image: '/images/landing/salon-tablet-manager.jpg',
      badge: 'Executive Dashboard',
    },
    {
      title: 'Seamless Workstation & Stylist Sync',
      role: 'Stylists & Floor Managers',
      description:
        'Stylists check their daily appointment schedule, client preference notes, and chemical formulas directly at their stations without interrupting service.',
      image: '/images/landing/salon-multi-staff.jpg',
      badge: 'Floor Operations',
    },
  ];

  return (
    <section id="experience" className="py-20 md:py-28 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-800 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
            Real Salon Experience
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            MyChair Operating Live in Premium Salons
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Experience how MyChair blends naturally into luxury salon interiors while keeping your business connected.
          </p>
        </div>

        {/* Experience Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {experiences.map((exp, idx) => (
            <div
              key={idx}
              className="group bg-slate-50 rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Image Frame */}
                <div className="relative h-64 overflow-hidden bg-slate-900">
                  <img
                    src={exp.image}
                    alt={exp.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 bg-slate-900/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold border border-slate-700">
                    {exp.badge}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    {exp.role}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-sky-600 transition-colors">
                    {exp.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {exp.description}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-0 border-t border-slate-200/50 mt-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Check className="w-4 h-4 text-sky-500" />
                  <span>Real Salon Workflows</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
