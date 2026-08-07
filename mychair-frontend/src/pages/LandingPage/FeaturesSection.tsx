import React from 'react';
import {
  CalendarDays,
  CreditCard,
  UserPlus,
  PackageCheck,
  Clock,
  CircleDollarSign,
  TrendingUp,
  ReceiptText,
  Building2,
  ShieldCheck,
  Cloud,
  Lock,
} from 'lucide-react';

interface FeatureItem {
  icon: React.ElementType;
  title: string;
  description: string;
}

export const FeaturesSection: React.FC = () => {
  const features: FeatureItem[] = [
    {
      icon: CalendarDays,
      title: 'Appointment Management',
      description: 'Effortless walk-in and online booking sync with multi-stylist calendars.',
    },
    {
      icon: CreditCard,
      title: 'POS Billing',
      description: 'Rapid 3-click checkout with instant digital invoices and split payment modes.',
    },
    {
      icon: UserPlus,
      title: 'Customer CRM',
      description: 'Track client history, preferred services, chemical formulas, and loyalty points.',
    },
    {
      icon: PackageCheck,
      title: 'Inventory Tracking',
      description: 'Real-time stock monitoring with automatic low-stock triggers and audit logs.',
    },
    {
      icon: Clock,
      title: 'Staff Attendance',
      description: 'Biometric-ready clock-in/out tracking with shift scheduling and leave logs.',
    },
    {
      icon: CircleDollarSign,
      title: 'Salary & Incentives',
      description: 'Automated commission calculations and transparent monthly staff payouts.',
    },
    {
      icon: TrendingUp,
      title: 'Business Reports',
      description: 'Comprehensive financial analytics, profit margins, and daily sales trends.',
    },
    {
      icon: ReceiptText,
      title: 'Expense Tracking',
      description: 'Categorized salon operating expense logs for accurate net profitability.',
    },
    {
      icon: Building2,
      title: 'Multi-Branch Support',
      description: 'Monitor and manage multiple salon locations from a single dashboard.',
    },
    {
      icon: ShieldCheck,
      title: 'Role-Based Access',
      description: 'Granular permissions for owners, managers, receptionists, and stylists.',
    },
    {
      icon: Cloud,
      title: 'Cloud Data',
      description: 'Real-time cloud synchronization with automated backups and 99.99% availability.',
    },
    {
      icon: Lock,
      title: 'Secure System',
      description: 'Enterprise-grade SSL encryption and secure role authentication protecting your data.',
    },
  ];

  return (
    <section id="features" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-800 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
            Platform Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Everything You Need to Scale Your Salon
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Purpose-built tools designed to eliminate operational friction and deliver an extraordinary client experience.
          </p>
        </div>

        {/* 12 Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="group relative bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300 mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2 group-hover:text-sky-600 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <span>Standard Feature</span>
                  <span className="text-sky-500 font-bold group-hover:translate-x-0.5 transition-transform">✓ Included</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
