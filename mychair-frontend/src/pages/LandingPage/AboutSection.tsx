import React from 'react';
import { ShieldCheck, HeartHandshake, Sparkles } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <section id="about" className="py-20 md:py-28 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="bg-slate-50 rounded-3xl p-8 sm:p-12 lg:p-16 border border-slate-200/80 shadow-sm relative overflow-hidden">
          {/* Subtle Decorator */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-100/50 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-6">
            
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-800 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              <span>About MyChair</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
              Built to Simplify Salon Operations with Uncompromising Business Quality
            </h2>

            <div className="space-y-4 text-slate-600 text-base sm:text-lg leading-relaxed">
              <p>
                MyChair was founded with a singular purpose: salon management should be as calm, polished, and effortless as the beauty services you deliver to your clients.
              </p>
              <p>
                We recognized that salon owners spend far too many hours managing appointment conflicts, tracking stock manually, reconciling daily cash registers, and calculating staff incentives on paper.
              </p>
              <p>
                MyChair brings every aspect of salon operations into one unified, intelligent platform. By blending modern technology with intuitive design, we empower salon owners and managers to focus on what matters most — delivering exceptional client hospitality and growing a profitable business.
              </p>
            </div>

            {/* Core Values */}
            <div className="pt-6 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-200/60">
                <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Unwavering Reliability</h4>
                  <p className="text-xs text-slate-500 mt-0.5">High availability cloud infrastructure ready for peak salon hours.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-200/60">
                <HeartHandshake className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Human-Centered Design</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Crafted so every team member can operate with zero stress.</p>
                </div>
              </div>
            </div>


          </div>
        </div>

      </div>
    </section>
  );
};
