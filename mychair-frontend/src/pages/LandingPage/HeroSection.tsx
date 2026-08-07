import React from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Mail, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';

interface HeroSectionProps {
  onContactClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onContactClick }) => {
  const navigate = useNavigate();

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-white">
      {/* Background Decorator Gradients */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-sky-100/40 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-slate-100/60 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-6 space-y-8 text-left">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200/80 rounded-full px-3.5 py-1.5 shadow-2xs">
              <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-700 tracking-wide">
                Next-Gen Salon Management System
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.12]">
              Run Your Entire Salon From One Smart Platform
            </h1>

            {/* Supporting Paragraph */}
            <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed max-w-xl">
              Manage appointments, billing, inventory, staff, customers, reports, and daily salon operations with one simple and powerful system.
            </p>

            {/* Action Buttons (Strictly Login & Contact Us, NO Register) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <button
                onClick={() => navigate('/auth/login')}
                className="inline-flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base px-8 py-4 rounded-full shadow-md hover:shadow-lg transition-all group hover:scale-[1.01]"
              >
                <span>Login</span>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onContactClick}
                className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-base px-7 py-4 rounded-full border border-slate-200/80 transition-all hover:scale-[1.01]"
              >
                <Mail className="w-5 h-5 text-slate-600" />
                <span>Contact Us</span>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-500" />
                <span>Zero Installation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-500" />
                <span>Cloud Data Security</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-500" />
                <span>24/7 Dedicated Support</span>
              </div>
            </div>
          </div>

          {/* Right Column: Premium Multi-Device Showcase Image */}
          <div className="lg:col-span-6">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              
              {/* Decorative Card Framing */}
              <div className="relative rounded-2xl p-2 bg-gradient-to-b from-slate-200/60 to-slate-100/40 border border-slate-200/80 shadow-2xl overflow-hidden group">
                <img
                  src="/images/landing/salon-hero-collage.jpg"
                  alt="MyChair Salon Management System Multi-device Showcase"
                  className="w-full h-auto rounded-xl object-cover transform transition-transform duration-700 group-hover:scale-[1.01]"
                />

                {/* Floating Metric Pill 1 */}
                <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl p-3.5 shadow-lg hidden sm:flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-slate-400">Daily Sales Today</div>
                    <div className="text-base font-bold text-slate-900">₹1,58,000</div>
                  </div>
                </div>

                {/* Floating Metric Pill 2 */}
                <div className="absolute top-6 right-6 bg-slate-900/90 text-white backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-lg hidden sm:flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-300">Live Status</div>
                    <div className="text-xs font-semibold text-sky-300">24 Appointments Active</div>
                  </div>
                </div>
              </div>

              {/* Sub-caption */}
              <p className="mt-3 text-center text-xs text-slate-400 font-medium">
                MyChair running live on desktop, tablet, and mobile across luxury salon reception & workstations.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
