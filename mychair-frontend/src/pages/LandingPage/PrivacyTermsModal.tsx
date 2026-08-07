import React from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';

interface PrivacyTermsModalProps {
  isOpen: boolean;
  type: 'privacy' | 'terms' | null;
  onClose: () => void;
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  isOpen,
  type,
  onClose,
}) => {
  if (!isOpen || !type) return null;

  const isPrivacy = type === 'privacy';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            {isPrivacy ? (
              <ShieldCheck className="w-5 h-5 text-sky-600" />
            ) : (
              <FileText className="w-5 h-5 text-sky-600" />
            )}
            <h3 className="text-lg font-bold text-slate-900">
              {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed">
          {isPrivacy ? (
            <>
              <p className="font-semibold text-slate-900">Effective Date: August 2026</p>
              <p>
                At MyChair, we prioritize protecting your salon data, customer information, and business records with enterprise-grade security standards.
              </p>
              <h4 className="font-bold text-slate-900 text-base pt-2">1. Data Ownership</h4>
              <p>
                You retain 100% ownership of your salon business data, client CRM records, inventory details, and billing history. MyChair does not sell, trade, or rent your salon data to third parties.
              </p>
              <h4 className="font-bold text-slate-900 text-base pt-2">2. Data Security & Encryption</h4>
              <p>
                All data transmitted between your device and MyChair servers is encrypted using 256-bit TLS encryption. Daily automated cloud backups ensure data redundancy and protection.
              </p>
              <h4 className="font-bold text-slate-900 text-base pt-2">3. Role-Based Access Control</h4>
              <p>
                MyChair implements strict role permissions. Salon staff members only have access to information essential for performing their designated duties.
              </p>
              <h4 className="font-bold text-slate-900 text-base pt-2">4. Support Contact</h4>
              <p>
                For privacy inquiries or data requests, please contact us at <a href="mailto:support@mychair.com" className="text-sky-600 font-semibold underline">support@mychair.com</a>.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-900">Effective Date: August 2026</p>
              <p>
                Welcome to MyChair. By accessing or using our Salon Management System, you agree to comply with and be bound by the following terms.
              </p>
              <h4 className="font-bold text-slate-900 text-base pt-2">1. Account Access & Security</h4>
              <p>
                Salon owners and administrators are responsible for maintaining the confidentiality of their credentials and controlling role-based access for their staff members.
              </p>
              <h4 className="font-bold text-slate-900 text-base pt-2">2. Software Usage</h4>
              <p>
                MyChair grants you a non-exclusive subscription license to use our platform for managing your salon business operations, appointment scheduling, billing, inventory, and staff management.
              </p>
              <h4 className="font-bold text-slate-900 text-base pt-2">3. System Uptime SLA</h4>
              <p>
                We strive to maintain 99.99% cloud availability for salon operations. Scheduled maintenance is communicated in advance during non-peak salon hours.
              </p>
              <h4 className="font-bold text-slate-900 text-base pt-2">4. Support</h4>
              <p>
                For assistance with software setup, billing, or technical queries, reach out directly to <a href="mailto:support@mychair.com" className="text-sky-600 font-semibold underline">support@mychair.com</a>.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2.5 rounded-full transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
