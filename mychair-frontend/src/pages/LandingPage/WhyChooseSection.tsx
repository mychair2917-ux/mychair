import React from 'react';
import {
  Sparkles,
  Zap,
  UserCheck,
  LineChart,
  Package,
  ShieldAlert,
  Cloud,
  Headphones,
  Check,
} from 'lucide-react';

interface BenefitCard {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  benefit: string;
}

export const WhyChooseSection: React.FC = () => {
  const benefits: BenefitCard[] = [
    {
      icon: Sparkles,
      title: 'Simple Interface',
      subtitle: 'Zero Learning Curve',
      benefit: 'Clean, clutter-free design that your entire salon team can master in under 15 minutes.',
    },
    {
      icon: Zap,
      title: 'Fast Billing',
      subtitle: '3-Click Checkout',
      benefit: 'Eliminate reception desk queues with instant invoicing, GST auto-calculation, and digital receipts.',
    },
    {
      icon: UserCheck,
      title: 'Accurate Staff Management',
      subtitle: 'Automated Commissions',
      benefit: 'Track stylist shifts, service attendance, and transparent commission calculations automatically.',
    },
    {
      icon: LineChart,
      title: 'Business Insights',
      subtitle: 'Real-Time Financials',
      benefit: 'Understand peak service hours, daily revenue trends, and client retention with clear visual charts.',
    },
    {
      icon: Package,
      title: 'Easy Inventory Tracking',
      subtitle: 'Zero Stockouts',
      benefit: 'Monitor professional salon products and retail items in real time with automatic low-stock alerts.',
    },
    {
      icon: ShieldAlert,
      title: 'Reliable Performance',
      subtitle: '99.99% Uptime',
      benefit: 'Built on high-performance cloud architecture to handle busy weekend rushes without lag or downtime.',
    },
    {
      icon: Cloud,
      title: 'Cloud Based',
      subtitle: 'Access Anywhere',
      benefit: 'Monitor your salon status anytime from any desktop, laptop, tablet, or smartphone securely.',
    },
    {
      icon: Headphones,
      title: 'Professional Support',
      subtitle: 'Dedicated Email Assistance',
      benefit: 'Direct access to support specialists ready to solve operational questions swiftly.',
    },
  ];

  return (
    <section id="why-us" className="py-20 md:py-28 bg-slate-900 text-white relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-sky-500/20 border border-sky-400/30 text-sky-300 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
            The MyChair Advantage
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Why Leading Salons Choose MyChair
          </h2>
          <p className="text-slate-300 text-base sm:text-lg">
            Engineered with extreme care to bring luxury, efficiency, and quiet confidence to your salon management.
          </p>
        </div>

        {/* 8 Benefit Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-6 hover:border-sky-500/50 hover:bg-slate-800 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-full">
                      {item.subtitle}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white tracking-tight mb-2 group-hover:text-sky-300 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-slate-300 text-sm leading-relaxed">
                    {item.benefit}
                  </p>
                </div>

                <div className="pt-4 mt-6 border-t border-slate-700/60 flex items-center gap-2 text-xs font-medium text-slate-400">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Built-in Excellence</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
