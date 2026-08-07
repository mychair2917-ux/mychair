import React from 'react';
import { useNavigate } from 'react-router';
import { Mail, ArrowUpRight } from 'lucide-react';

interface LandingFooterProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onContactClick: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onOpenPrivacy,
  onOpenTerms,
  onContactClick,
}) => {
  const navigate = useNavigate();

  const handleScroll = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Main Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Brand Col */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <img src="/images/logo.png" alt="MyChair Logo" className="h-9 w-auto object-contain bg-white/90 p-1 rounded-lg" />
              <span className="font-sans font-bold text-xl text-white tracking-tight">
                MyChair
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              The luxury Salon Management System designed to elevate appointments, billing, inventory, staff, and customer hospitality.
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-4 grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Product
              </div>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => handleScroll('#showcase')} className="hover:text-white transition-colors">
                    Showcase
                  </button>
                </li>
                <li>
                  <button onClick={() => handleScroll('#features')} className="hover:text-white transition-colors">
                    Features
                  </button>
                </li>
                <li>
                  <button onClick={() => handleScroll('#why-us')} className="hover:text-white transition-colors">
                    Why MyChair
                  </button>
                </li>
                <li>
                  <button onClick={() => handleScroll('#experience')} className="hover:text-white transition-colors">
                    Experience
                  </button>
                </li>
                <li>
                  <button onClick={() => handleScroll('#about')} className="hover:text-white transition-colors">
                    About
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Legal & Access
              </div>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => navigate('/auth/login')} className="hover:text-sky-300 font-semibold text-white flex items-center gap-1">
                    <span>Login</span>
                    <ArrowUpRight className="w-3 h-3 text-sky-400" />
                  </button>
                </li>
                <li>
                  <button onClick={onContactClick} className="hover:text-white transition-colors">
                    Contact Us
                  </button>
                </li>
                <li>
                  <button onClick={onOpenPrivacy} className="hover:text-white transition-colors">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button onClick={onOpenTerms} className="hover:text-white transition-colors">
                    Terms of Service
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Col */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Support Email
            </div>
            <a
              href="mailto:support@mychair.com"
              className="inline-flex items-center gap-2 text-sm text-sky-300 hover:text-white font-semibold transition-colors"
            >
              <Mail className="w-4 h-4 text-sky-400" />
              <span>support@mychair.com</span>
            </a>
            <p className="text-[11px] text-slate-500">
              Dedicated salon customer support & inquiries.
            </p>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} MyChair Systems Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onOpenPrivacy} className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </button>
            <span>•</span>
            <button onClick={onOpenTerms} className="hover:text-slate-300 transition-colors">
              Terms of Service
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
