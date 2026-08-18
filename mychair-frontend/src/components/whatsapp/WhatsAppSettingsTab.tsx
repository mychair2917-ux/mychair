import React, { useState } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  HelpCircle,
  ShieldCheck,
  Zap,
  Phone,
  Building,
  Sliders,
  FileText,
  Clock,
} from 'lucide-react';
import {
  useGetWhatsAppStatusQuery,
  useConnectWhatsAppMutation,
  useDisconnectWhatsAppMutation,
  useUpdateWhatsAppSettingsMutation,
  useSendTestWhatsAppMessageMutation,
  useGetWhatsAppMessageLogsQuery,
} from '../../redux/slices/whatsapp/whatsappApi';

interface WhatsAppSettingsTabProps {
  salonId: string;
}

export const WhatsAppSettingsTab: React.FC<WhatsAppSettingsTabProps> = ({ salonId }) => {
  const { data: statusData, isLoading, refetch } = useGetWhatsAppStatusQuery({ salonId });
  const [connectWhatsApp, { isLoading: isConnecting }] = useConnectWhatsAppMutation();
  const [disconnectWhatsApp, { isLoading: isDisconnecting }] = useDisconnectWhatsAppMutation();
  const [updateSettings, { isLoading: isUpdating }] = useUpdateWhatsAppSettingsMutation();
  const [sendTestMessage, { isLoading: isSendingTest }] = useSendTestWhatsAppMessageMutation();

  const { data: logsData } = useGetWhatsAppMessageLogsQuery({ salonId, page: 1, limit: 10 });

  const account = statusData?.data;
  const isConnected = account?.status === 'CONNECTED';

  // Modal states
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // Connect form state
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessPhoneNumber, setBusinessPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Test form state
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!wabaId || !phoneNumberId || !businessPhoneNumber || !accessToken) {
      setFormError('Please fill in all required Meta WhatsApp API fields.');
      return;
    }

    try {
      const res = await connectWhatsApp({
        salon_id: salonId,
        waba_id: wabaId.trim(),
        phone_number_id: phoneNumberId.trim(),
        business_phone_number: businessPhoneNumber.trim(),
        display_name: displayName.trim() || 'Salon WhatsApp',
        access_token: accessToken.trim(),
      }).unwrap();

      if (res.success) {
        setFormSuccess('WhatsApp Business Account connected successfully!');
        setTimeout(() => {
          setShowConnectModal(false);
          setFormSuccess('');
        }, 1200);
      }
    } catch (err: any) {
      setFormError(err?.data?.detail || 'Failed to connect WhatsApp account.');
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('Are you sure you want to disconnect WhatsApp for this salon?')) {
      try {
        await disconnectWhatsApp({ salonId }).unwrap();
      } catch (err) {
        console.error('Failed to disconnect:', err);
      }
    }
  };

  const handleToggleFeature = async (featureKey: string, currentValue: boolean) => {
    if (!account) return;
    try {
      await updateSettings({
        salon_id: salonId,
        features: {
          [featureKey]: !currentValue,
        },
      }).unwrap();
    } catch (err) {
      console.error('Failed to update feature:', err);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);

    if (!testPhone) return;

    try {
      const res = await sendTestMessage({
        salon_id: salonId,
        recipient_phone: testPhone.trim(),
      }).unwrap();

      if (res.data?.status === 'SENT' || res.data?.status === 'QUEUED') {
        setTestResult({
          success: true,
          message: `Test message sent successfully to ${res.data.phone_number}! Message ID: ${res.data.wamid || 'queued'}`,
        });
      } else {
        setTestResult({
          success: false,
          message: res.data?.error_message || 'Failed to send test message.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.data?.detail || 'Test message request failed.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-emerald-500" />
        <span>Loading WhatsApp Integration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Status Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className={`p-4 rounded-2xl ${isConnected ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              <MessageSquare className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">WhatsApp Business Integration</h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected & Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    <XCircle className="w-3.5 h-3.5" /> Not Connected
                  </span>
                )}
              </div>

              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                Connect your salon&apos;s WhatsApp Business number to send direct billing receipts, automated appointment confirmations, reminders, and marketing campaigns directly through MYCHAIR.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowHelpModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors inline-flex items-center gap-2 border border-slate-700"
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" /> Need Help?
            </button>

            {isConnected ? (
              <>
                <button
                  onClick={() => setShowTestModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-sm font-semibold transition-all inline-flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Send Test Message
                </button>

                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-sm font-medium transition-all"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowConnectModal(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all inline-flex items-center gap-2"
              >
                <Zap className="w-4 h-4 fill-current" /> Connect WhatsApp
              </button>
            )}
          </div>
        </div>

        {/* Connected Account Quick Details */}
        {isConnected && account && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-500 font-medium">Business Phone Number</div>
              <div className="text-sm font-semibold text-white mt-1 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                {account.business_phone_number || 'N/A'}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-500 font-medium">Display Name</div>
              <div className="text-sm font-semibold text-white mt-1 flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-teal-400" />
                {account.display_name || 'Salon WhatsApp'}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-500 font-medium">Meta WABA ID</div>
              <div className="text-sm font-mono text-slate-300 mt-1 truncate">
                {account.waba_id || 'N/A'}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-500 font-medium">Connected On</div>
              <div className="text-sm font-medium text-slate-300 mt-1 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {account.connected_at ? new Date(account.connected_at).toLocaleDateString() : 'Active'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature Toggles & Automation Rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-bold text-white">Automated Messaging Capabilities</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              key: 'billing_enabled',
              title: 'Billing Receipts & Invoices',
              description: 'Automatically send WhatsApp digital receipt whenever a bill is marked PAID.',
              icon: FileText,
            },
            {
              key: 'appointment_confirmations_enabled',
              title: 'Appointment Confirmations',
              description: 'Send instant WhatsApp confirmation when a new appointment is booked.',
              icon: CheckCircle2,
            },
            {
              key: 'appointment_reminders_enabled',
              title: 'Appointment Reminders',
              description: 'Dispatch scheduled reminder messages prior to customer appointments.',
              icon: Clock,
            },
            {
              key: 'birthday_messages_enabled',
              title: 'Birthday Automation',
              description: 'Automatically wish clients on their birthday with special offer templates.',
              icon: Zap,
            },
            {
              key: 'marketing_enabled',
              title: 'Marketing & Promotional Campaigns',
              description: 'Allow sending segment marketing broadcasts using your salon number.',
              icon: Send,
            },
          ].map((item) => {
            const isEnabled = Boolean(account?.features?.[item.key as keyof typeof account.features] ?? true);
            const IconComp = item.icon;

            return (
              <div
                key={item.key}
                className={`p-4 rounded-xl border transition-all ${
                  isEnabled ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-950/30 border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg ${isEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleFeature(item.key, isEnabled)}
                    disabled={!isConnected || isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                    } ${(!isConnected || isUpdating) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Message Audit Log Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Recent WhatsApp Message Activity</h3>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {logsData?.data?.items && logsData.data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Template</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logsData.data.items.map((log) => {
                  const statusColors: Record<string, string> = {
                    SENT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    DELIVERED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    READ: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
                    FAILED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                    QUEUED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                  };

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-white">{log.phone_number}</td>
                      <td className="py-3 px-4 font-medium text-slate-300">{log.message_type}</td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono">{log.template_name || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[log.status] || 'bg-slate-800 text-slate-400'}`}>
                          {log.status}
                        </span>
                        {log.error_message && (
                          <div className="text-xs text-rose-400 mt-1 max-w-xs truncate" title={log.error_message}>
                            {log.error_message}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            No WhatsApp messages dispatched yet for this salon.
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" /> Connect Meta WhatsApp
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  {formSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp Business Account ID (WABA ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 109823471092837"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Meta Phone Number ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 102938475610293"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Business WhatsApp Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +919876543210"
                  value={businessPhoneNumber}
                  onChange={(e) => setBusinessPhoneNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Salon Display Name on WhatsApp</label>
                <input
                  type="text"
                  placeholder="e.g. Style Lounge Salon"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Meta System User Access Token</label>
                <input
                  type="password"
                  required
                  placeholder="EAA..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all inline-flex items-center gap-2"
                >
                  {isConnecting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Message Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-400" /> Send Test WhatsApp Message
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendTest} className="space-y-4">
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient Mobile Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +919876543210"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all inline-flex items-center gap-2"
                >
                  {isSendingTest && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Dispatch Test Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guidance / Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" /> WhatsApp Integration Guide
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                MYCHAIR integrates directly with Meta WhatsApp Cloud API without third-party middleman markup.
              </div>

              <div>
                <h4 className="font-semibold text-white text-sm mb-1">Step 1: Meta Developer App</h4>
                <p className="text-xs text-slate-400">
                  Log in to developers.facebook.com, select your business app, and add WhatsApp product.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white text-sm mb-1">Step 2: Obtain WABA & Phone Number ID</h4>
                <p className="text-xs text-slate-400">
                  From WhatsApp API Setup, copy your <strong>WhatsApp Business Account ID</strong> and <strong>Phone Number ID</strong>.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white text-sm mb-1">Step 3: Generate System User Token</h4>
                <p className="text-xs text-slate-400">
                  Generate a Permanent Meta System User Access Token with <code className="text-emerald-400">whatsapp_business_messaging</code> permissions.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 mt-6 border-t border-slate-800">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
