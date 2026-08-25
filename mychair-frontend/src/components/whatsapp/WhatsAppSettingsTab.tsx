import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react';

import {
  useGetWhatsAppConfigQuery,
  useGetWhatsAppStatusQuery,
  useExchangeEmbeddedSignupMutation,
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
  // Redux queries & mutations
  const { data: configRes, isLoading: isConfigLoading } = useGetWhatsAppConfigQuery();
  const { data: statusData, isLoading, refetch } = useGetWhatsAppStatusQuery({ salonId });
  const [exchangeEmbeddedSignup, { isLoading: isExchanging }] = useExchangeEmbeddedSignupMutation();
  const [connectWhatsApp, { isLoading: isConnectingManual }] = useConnectWhatsAppMutation();
  const [disconnectWhatsApp, { isLoading: isDisconnecting }] = useDisconnectWhatsAppMutation();
  const [updateSettings, { isLoading: isUpdating }] = useUpdateWhatsAppSettingsMutation();
  const [sendTestMessage, { isLoading: isSendingTest }] = useSendTestWhatsAppMessageMutation();

  const { data: logsData } = useGetWhatsAppMessageLogsQuery({ salonId, page: 1, limit: 10 });

  const config = configRes?.data;
  const account = statusData?.data;

  const isRealValue = (val?: string): boolean => {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim().toLowerCase();
    return (
      trimmed !== '' &&
      trimmed !== 'pending_phone_id' &&
      trimmed !== 'pending_waba_id' &&
      trimmed !== 'pending meta setup' &&
      trimmed !== 'pending'
    );
  };

  const isConnected = Boolean(
    ((account as any)?.connected ?? true) &&
    account?.status === 'CONNECTED' &&
    isRealValue(account?.phone_number_id) &&
    isRealValue(account?.business_phone_number)
  );

  const [isLaunchingSignup, setIsLaunchingSignup] = useState(false);
  const [connectError, setConnectError] = useState<string>('');
  const [connectSuccess, setConnectSuccess] = useState<string>('');

  // Modals state
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showNoConfigModal, setShowNoConfigModal] = useState(false);
  const [showDeveloperAccordion, setShowDeveloperAccordion] = useState(false);

  // Manual developer connection state
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessPhoneNumber, setBusinessPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [devFormError, setDevFormError] = useState('');
  const [devFormSuccess, setDevFormSuccess] = useState('');

  // Test form state
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Listen for Meta Embedded Signup messages
  const capturedWabaIdRef = React.useRef<string>('');
  const capturedPhoneIdRef = React.useRef<string>('');

  useEffect(() => {
    const handleMetaMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') {
        return;
      }
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH') {
            const { waba_id, phone_number_id } = data.data || {};
            if (waba_id) capturedWabaIdRef.current = waba_id;
            if (phone_number_id) capturedPhoneIdRef.current = phone_number_id;
          } else if (data.event === 'ERROR') {
            setConnectError(data.error_message || data.error || 'Meta Embedded Signup encountered an error.');
            setIsLaunchingSignup(false);
          }
        }
      } catch (e) {
        // Ignore parsing errors for unrelated messages
      }
    };

    window.addEventListener('message', handleMetaMessage);
    return () => window.removeEventListener('message', handleMetaMessage);
  }, []);

  // Load Facebook SDK dynamically
  useEffect(() => {
    if (!config?.app_id || (window as any).FB) return;

    (window as any).fbAsyncInit = function() {
      (window as any).FB.init({
        appId            : config.app_id,
        autoLogAppEvents : true,
        xfbml            : true,
        version          : 'v20.0'
      });
      console.log('[WhatsApp Connect] Facebook SDK initialized with app_id:', config.app_id);
    };

    const loadFbSdk = () => {
      const scriptId = 'facebook-jssdk';
      if (document.getElementById(scriptId)) return;
      const js = document.createElement('script');
      js.id = scriptId;
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      js.async = true;
      js.defer = true;
      document.body.appendChild(js);
    };

    loadFbSdk();
  }, [config?.app_id]);

  // Launch Meta Embedded Signup Flow via FB.login()
  const handleLaunchEmbeddedSignup = () => {
    console.log('[WhatsApp Connect] handler entered');
    console.log('[WhatsApp Connect] config state:', {
      config_present: !!config,
      app_id_present: !!(config as any)?.app_id,
      config_id_present: !!config?.config_id,
      FB_present: !!(window as any).FB,
      fbReady: !!(window as any).FB
    });

    setConnectError('');
    setConnectSuccess('');

    const configId = config?.config_id;

    if (!config?.configured || !configId) {
      console.log('[WhatsApp Connect] stopped: missing config or config_id');
      setShowNoConfigModal(true);
      return;
    }

    if (!(window as any).FB) {
      console.log('[WhatsApp Connect] stopped: FB not present');
      setConnectError('Meta Facebook SDK is not ready. Please refresh or check your network connection.');
      return;
    }

    setIsLaunchingSignup(true);

    try {
      console.log('[WhatsApp Connect] calling FB.login');
      (window as any).FB.login(
        (response: any) => {
          console.log('[WhatsApp Connect] FB.login callback received');
          console.log('[WhatsApp Connect] authResponse status:', response?.status, {
            authResponse_present: !!response?.authResponse,
            code_present: !!response?.authResponse?.code,
            code_length: response?.authResponse?.code ? response.authResponse.code.length : 0
          });

          setIsLaunchingSignup(false);
          if (response?.authResponse?.code) {
            const code = response.authResponse.code;
            console.log('[WhatsApp Connect] sending code to exchange handler');
            handleExchangeCode(code, capturedWabaIdRef.current, capturedPhoneIdRef.current);
          } else if (response?.status === 'not_authorized') {
            setConnectError('Meta authorization was not completed.');
          } else {
            setConnectError('Meta onboarding was cancelled or closed before authorization.');
          }
        },
        {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            sessionInfoVersion: 3,
          },
        }
      );
    } catch (err: any) {
      setIsLaunchingSignup(false);
      setConnectError(err?.message || 'Failed to launch Meta Embedded Signup.');
    }
  };

  // Ref to prevent duplicate code exchange attempts
  const lastExchangedCodeRef = React.useRef<string>('');

  // Exchange authorization code with backend
  const handleExchangeCode = async (code: string, wabaId?: string, phoneId?: string) => {
    console.log('[WhatsApp Connect] handleExchangeCode entered');
    if (!code) return;
    if (lastExchangedCodeRef.current === code) {
      console.warn('Authorization token/code has already been processed for exchange.');
      return;
    }
    lastExchangedCodeRef.current = code;

    setConnectError('');
    setConnectSuccess('');

    try {
      const payload: any = {
        salon_id: salonId,
        code: code,
      };
      if (wabaId) payload.waba_id = wabaId;
      if (phoneId) payload.phone_number_id = phoneId;

      console.log('[WhatsApp Connect] calling embedded-signup/exchange API');
      const res = await exchangeEmbeddedSignup(payload).unwrap();

      if (res.success) {
        setConnectSuccess('WhatsApp Business Account connected successfully via Meta Embedded Signup!');
      }
    } catch (err: any) {
      setConnectError(err?.data?.detail || 'Failed to complete Meta Embedded Signup connection.');
    }
  };

  // Disconnect salon WABA
  const handleDisconnect = async () => {
    if (window.confirm('Are you sure you want to disconnect WhatsApp for this salon?')) {
      try {
        await disconnectWhatsApp({ salonId }).unwrap();
        setConnectSuccess('');
        setConnectError('');
      } catch (err: any) {
        console.error('Failed to disconnect:', err);
      }
    }
  };

  // Developer manual connection submit
  const handleDevConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevFormError('');
    setDevFormSuccess('');

    if (!wabaId || !phoneNumberId || !businessPhoneNumber || !accessToken) {
      setDevFormError('Please fill in all required Meta WhatsApp API fields.');
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
        setDevFormSuccess('WhatsApp Business Account connected manually via Developer settings.');
        setTimeout(() => {
          setDevFormSuccess('');
        }, 3000);
      }
    } catch (err: any) {
      setDevFormError(err?.data?.detail || 'Failed to connect WhatsApp account manually.');
    }
  };

  // Toggle automated messaging features
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

  // Send test message
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

  if (isLoading || isConfigLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-emerald-500" />
        <span>Loading WhatsApp Integration...</span>
      </div>
    );
  }

  const isConnecting = isLaunchingSignup || isExchanging;

  return (
    <div className="space-y-6">
      {/* Primary Connection Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div
              className={`p-4 rounded-2xl ${
                isConnected
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <MessageSquare className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-white">WhatsApp Business Integration</h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> WhatsApp Connected
                  </span>
                ) : account?.status === 'AUTHORIZED' || account?.connection_status === 'AUTHORIZED' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Meta Authorized
                  </span>
                ) : account?.status === 'VERIFICATION_REQUIRED' || account?.connection_status === 'VERIFICATION_REQUIRED' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5" /> Phone Verification Required
                  </span>
                ) : account?.status === 'COEXISTENCE_REQUIRED' || account?.connection_status === 'COEXISTENCE_REQUIRED' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <AlertTriangle className="w-3.5 h-3.5" /> Existing WhatsApp Business Number
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    <XCircle className="w-3.5 h-3.5" /> Not Connected
                  </span>
                )}
              </div>

              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                Connect your salon&apos;s WhatsApp Business number using Meta&apos;s 1-click official onboarding. Send automated receipts, appointment confirmations, reminders, and customer campaigns.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowHelpModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors inline-flex items-center gap-2 border border-slate-700"
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" /> Guide & Setup
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
                  onClick={handleLaunchEmbeddedSignup}
                  disabled={isConnecting}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-sm font-medium transition-all inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Reconnect
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
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    console.log('[WhatsApp Connect] button clicked');
                    handleLaunchEmbeddedSignup();
                  }}
                  disabled={isConnecting}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/20 transition-all inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Connecting with Meta...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current text-white" />
                      <span>Connect WhatsApp</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error / Success Notifications */}

        {connectError && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Meta Connection Failed</span>
              <span>{connectError}</span>
            </div>
            <button
              onClick={handleLaunchEmbeddedSignup}
              className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {connectSuccess && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{connectSuccess}</span>
          </div>
        )}

        {/* Setup, Coexistence & Verification Alerts */}
        {!isConnected && (account?.status === 'AUTHORIZED' || account?.connection_status === 'AUTHORIZED' || account?.status === 'PHONE_SETUP_REQUIRED' || account?.status === 'PHONE_SELECTION_REQUIRED') && (
          <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm flex items-start gap-3">
            <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-400" />
            <div>
              <span className="font-semibold block text-blue-200">WhatsApp Number Setup Required</span>
              <span>
                Meta authorization is complete, but no active WhatsApp phone number has been linked yet. Please complete phone number selection in Meta Embedded Signup.
              </span>
            </div>
          </div>
        )}

        {(account?.status === 'COEXISTENCE_REQUIRED' || account?.connection_status === 'COEXISTENCE_REQUIRED') && (
          <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-purple-400" />
            <div>
              <span className="font-semibold block text-purple-200">Existing WhatsApp Business Number / Finish Meta Coexistence Setup</span>
              <span>
                This phone number is currently active on the WhatsApp Business App mobile client. Meta requires completing phone number verification in Meta Business Manager to enable Cloud API coexistence. MYCHAIR will not automatically overwrite or disconnect your existing mobile app.
              </span>
            </div>
          </div>
        )}

        {(account?.status === 'VERIFICATION_REQUIRED' || account?.connection_status === 'VERIFICATION_REQUIRED') && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-semibold block text-amber-200">Phone Verification Required</span>
              <span>
                Your WhatsApp number has been linked, but Meta requires 2FA SMS code verification in Meta Business Manager before outbound messages can be dispatched.
              </span>
            </div>
          </div>
        )}

        {/* Connected Account Display Details (NEVER EXPOSES ACCESS TOKENS) */}
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
              <div className="text-xs text-slate-500 font-medium">Salon Display Name</div>
              <div className="text-sm font-semibold text-white mt-1 flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-teal-400" />
                {account.display_name || 'Salon WhatsApp'}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-500 font-medium">Status</div>
              <div className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Active ({account.connection_status || 'ACTIVE'})
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

      {/* Advanced / Developer Connection (Clearly Separated Accordion) */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg">
        <button
          onClick={() => setShowDeveloperAccordion(!showDeveloperAccordion)}
          className="w-full p-4 bg-slate-950/40 hover:bg-slate-950/80 transition-colors flex items-center justify-between text-left border-b border-slate-800/50"
        >
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                Advanced / Developer Connection
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Super Admin / Dev Testing
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Manual token entry option for internal testing. Salon owners should use the primary Meta Connect button above.
              </p>
            </div>
          </div>
          {showDeveloperAccordion ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showDeveloperAccordion && (
          <div className="p-6 bg-slate-950/60 border-t border-slate-800/60">
            <form onSubmit={handleDevConnectSubmit} className="space-y-4 max-w-xl">
              {devFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {devFormError}
                </div>
              )}
              {devFormSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  {devFormSuccess}
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Salon Display Name on WhatsApp</label>
                <input
                  type="text"
                  placeholder="e.g. Style Lounge Salon"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isConnectingManual}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all inline-flex items-center gap-2"
                >
                  {isConnectingManual && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Manual Connect (Dev Only)
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

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

      {/* Meta Config Missing Notice Modal */}
      {showNoConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" /> Meta App Setup Required
              </h3>
              <button
                onClick={() => setShowNoConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <p>
                Meta Embedded Signup requires setting the Meta App ID and Configuration ID in your server environment variables:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl font-mono text-xs text-amber-300 space-y-1">
                <div>META_APP_ID=your_meta_app_id</div>
                <div>META_EMBEDDED_SIGNUP_CONFIG_ID=your_config_id</div>
              </div>
              <p className="text-xs text-slate-400">
                For local development or manual testing, you can use the <strong>Advanced / Developer Connection</strong> option at the bottom of this tab.
              </p>
            </div>

            <div className="flex items-center justify-end pt-4 mt-6 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowNoConfigModal(false);
                  setShowDeveloperAccordion(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold"
              >
                Use Developer Mode
              </button>
            </div>
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
                MYCHAIR integrates directly with Meta WhatsApp Cloud API via official Embedded Signup without third-party middleman markup.
              </div>

              <div>
                <h4 className="font-semibold text-white text-sm mb-1">Step 1: Click Connect WhatsApp</h4>
                <p className="text-xs text-slate-400">
                  Salon owners simply click <strong>Connect WhatsApp</strong>. Meta will prompt you to authenticate your Facebook/Meta Business account.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white text-sm mb-1">Step 2: Select Meta Business & WhatsApp Number</h4>
                <p className="text-xs text-slate-400">
                  Select your Meta Business Portfolio, pick your existing WhatsApp Business number or add a new number, and complete phone verification.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white text-sm mb-1">Step 3: Return to MYCHAIR</h4>
                <p className="text-xs text-slate-400">
                  MYCHAIR automatically receives authorization and activates automated billing receipts, appointment confirmations, and reminders.
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
