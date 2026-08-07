import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Receipt,
  Boxes,
  Users,
  UserCheck,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';

interface ShowcaseModule {
  id: string;
  title: string;
  oneLiner: string;
  icon: React.ElementType;
  image: string;
  metrics: { label: string; value: string }[];
  keyHighlights: string[];
}

export const ProductShowcase: React.FC = () => {
  const modules: ShowcaseModule[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      oneLiner: 'Real-time revenue, appointment count, and operational KPIs in one clean view.',
      icon: LayoutDashboard,
      image: '/images/landing/salon-hero-collage.jpg',
      metrics: [
        { label: 'Today\'s Sales', value: '₹1,58,000' },
        { label: 'Appointments', value: '112' },
        { label: 'Pedicurist Activity', value: '94%' },
      ],
      keyHighlights: [
        'Instant overview of daily sales & revenue',
        'Live appointment queue updates',
        'Quick action shortcuts for billing & bookings',
      ],
    },
    {
      id: 'appointments',
      title: 'Appointments',
      oneLiner: 'Effortless visual calendar scheduling with staff allocation and client sync.',
      icon: CalendarDays,
      image: '/images/landing/salon-multi-staff.jpg',
      metrics: [
        { label: 'Booking Rate', value: '98%' },
        { label: 'Avg Time Saved', value: '45 mins/day' },
        { label: 'Walk-in Sync', value: 'Instant' },
      ],
      keyHighlights: [
        'Interactive grid view across multiple chairs',
        'Stylist availability & service assignment',
        'Automated appointment status tracking',
      ],
    },
    {
      id: 'billing',
      title: 'Billing & POS',
      oneLiner: 'Lightning-fast checkout with GST compliance, discounts, and split payment modes.',
      icon: Receipt,
      image: '/images/landing/salon-pos-reception.jpg',
      metrics: [
        { label: 'Checkout Speed', value: '< 10 Seconds' },
        { label: 'Payment Modes', value: 'UPI, Card, Cash' },
        { label: 'GST Compliance', value: '100% Automated' },
      ],
      keyHighlights: [
        'One-tap invoice printing and digital WhatsApp receipts',
        'Integrated discounts and membership redemption',
        'End-of-day register reconciliation',
      ],
    },
    {
      id: 'inventory',
      title: 'Inventory',
      oneLiner: 'Track stock levels, low-stock warnings, and retail product sales effortlessly.',
      icon: Boxes,
      image: '/images/landing/salon-tablet-manager.jpg',
      metrics: [
        { label: 'SKU Count', value: '500+ Items' },
        { label: 'Stock Accuracy', value: '99.8%' },
        { label: 'Low Stock Alert', value: 'Automated' },
      ],
      keyHighlights: [
        'Real-time retail vs internal consumption audit',
        'Barcode scanner integration support',
        'Supplier reorder alerts before products run out',
      ],
    },
    {
      id: 'customers',
      title: 'Customer Management',
      oneLiner: 'Comprehensive client profiles, visit history, preferences, and loyalty rewards.',
      icon: Users,
      image: '/images/landing/salon-luxury-reception.jpg',
      metrics: [
        { label: 'Retention Rate', value: '+34%' },
        { label: 'Client CRM', value: 'Complete History' },
        { label: 'Loyalty Points', value: 'Auto-Calculated' },
      ],
      keyHighlights: [
        'Detailed visit log and chemical treatment notes',
        'Personalized birthday & anniversary offers',
        'Client spending tiers and VIP memberships',
      ],
    },
    {
      id: 'staff',
      title: 'Staff Management',
      oneLiner: 'Track stylist attendance, shift schedules, commissions, and performance.',
      icon: UserCheck,
      image: '/images/landing/salon-multi-staff.jpg',
      metrics: [
        { label: 'Shift Coverage', value: '100%' },
        { label: 'Incentive Engine', value: 'Automated' },
        { label: 'Attendance Log', value: 'Biometric Sync' },
      ],
      keyHighlights: [
        'Individual staff service commission calculations',
        'Shift schedules & leave approvals',
        'Performance leaderboards by revenue generated',
      ],
    },
    {
      id: 'reports',
      title: 'Reports & Analytics',
      oneLiner: 'Deep business insights into profit margins, top services, and growth trends.',
      icon: BarChart3,
      image: '/images/landing/salon-tablet-manager.jpg',
      metrics: [
        { label: 'Data Accuracy', value: 'Real-Time' },
        { label: 'Export Modes', value: 'Excel & PDF' },
        { label: 'Insights', value: 'Revenue & Expenses' },
      ],
      keyHighlights: [
        'Monthly profit & loss statement breakdowns',
        'Top performing services and stylist ranking',
        'Peak hours analysis for staff shift optimization',
      ],
    },
  ];

  const [activeTab, setActiveTab] = useState(modules[0].id);
  const activeModule = modules.find((m) => m.id === activeTab) || modules[0];

  return (
    <section id="showcase" className="py-20 md:py-28 bg-slate-50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-sky-50 border border-sky-100 text-sky-700 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
            Product Showcase
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Designed for Every Detail of Your Salon Operations
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Explore the specialized modules engineered to make daily salon management quiet, organized, and profitable.
          </p>
        </div>

        {/* Tab Buttons Navigation */}
        <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto pb-4 scrollbar-none mb-10">
          {modules.map((m) => {
            const Icon = m.icon;
            const isActive = m.id === activeTab;
            return (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 border ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                <span>{m.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Module Display Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden p-6 lg:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Module Information */}
            <div className="lg:col-span-5 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-800 text-xs font-semibold px-3 py-1 rounded-lg">
                <activeModule.icon className="w-4 h-4 text-sky-600" />
                <span>Module Overview</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {activeModule.title}
              </h3>

              <p className="text-slate-600 text-base leading-relaxed">
                {activeModule.oneLiner}
              </p>

              {/* Key Highlights List */}
              <div className="space-y-3 pt-2">
                {activeModule.keyHighlights.map((highlight, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-slate-700">{highlight}</span>
                  </div>
                ))}
              </div>

              {/* Metric Chips */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                {activeModule.metrics.map((metric, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{metric.label}</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Screenshot Preview */}
            <div className="lg:col-span-7">
              <div className="relative rounded-xl border border-slate-200 overflow-hidden shadow-lg bg-slate-900 group">
                <img
                  src={activeModule.image}
                  alt={`MyChair ${activeModule.title} Module`}
                  className="w-full h-80 sm:h-[400px] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                
                {/* Overlay Badge */}
                <div className="absolute top-4 left-4 bg-slate-900/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-md border border-slate-700/80 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>MyChair Live Screen</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
