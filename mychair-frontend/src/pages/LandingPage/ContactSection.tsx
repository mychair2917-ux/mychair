import React, { useState } from 'react';
import { Mail, Copy, Check, Clock, ShieldCheck } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const email = 'support@mychair.com';

  const handleCopy = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section id="contact" className="py-20 md:py-28 bg-slate-900 text-white relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-sky-500/20 border border-sky-400/30 text-sky-300 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
          Direct Contact
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-3 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Have Questions? Get in Touch With Us
          </h2>
          <p className="text-slate-300 text-base sm:text-lg">
            Our team is dedicated to supporting your salon business. Reach out anytime with inquiries or product feedback.
          </p>
        </div>

        {/* Support Email Card */}
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-3xl p-8 sm:p-12 max-w-xl mx-auto shadow-2xl space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mx-auto">
            <Mail className="w-8 h-8" />
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Official Support Email
            </div>
            <a
              href={`mailto:${email}`}
              className="text-2xl sm:text-3xl font-bold text-white hover:text-sky-300 transition-colors tracking-tight block underline decoration-sky-500/40 underline-offset-4"
            >
              {email}
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm px-6 py-3 rounded-full transition-all shadow-md"
            >
              <Mail className="w-4 h-4" />
              <span>Send Email</span>
            </a>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm px-5 py-3 rounded-full transition-all border border-slate-600"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-300" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
          </div>

          {/* SLA note */}
          <div className="pt-6 border-t border-slate-700/60 flex items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Avg Response Time: &lt; 2 Hours</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Direct Support Team</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
