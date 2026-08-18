import React, { useState, useEffect, useRef } from 'react';
import { Plus, FileText, X, Sparkles } from 'lucide-react';
import { Button, Input, Select } from '../common';
import {
  useCreateQuickAppointmentMutation,
  useLazySearchAppointmentClientsQuery,
  useLazyCheckAppointmentClientPhoneQuery,
  useLazyGenerateAppointmentClientIdQuery,
  useCreateAppointmentClientMutation,
} from '../../redux/slices/appointments/appointmentsApi';
import { AppointmentClient } from '../../redux/slices/appointments/Types';
import { showToast } from '../common/Toast/toastService';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { generateLocalClientId } from '../../utils/clientId';
import { useAppSelector } from '../../redux/hooks';
import { normalizeRole } from '../../config/rbac';
import { ROLES } from '../../constants';
import { useDebouncedSearch } from '../../hooks';
import { cn } from '../../utils/cn';

interface AppointmentQuickEntryProps {
  salonId: string;
  onAppointmentCreated?: () => void;
}

const clientGenderOptions = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

export const AppointmentQuickEntry: React.FC<AppointmentQuickEntryProps> = ({
  salonId,
  onAppointmentCreated,
}) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const normalizedRole = normalizeRole(currentUser?.role);

  const canCreate = [
    ROLES.SUPER_ADMIN,
    ROLES.SALON_OWNER,
    ROLES.SALON_MANAGER,
    ROLES.SALON_ADMIN,
    ROLES.ADMIN,
  ].includes(normalizedRole as any);

  const allowMembership = [
    ROLES.SUPER_ADMIN,
    ROLES.SALON_OWNER,
    ROLES.SALON_ADMIN,
    ROLES.ADMIN,
    ROLES.SALON_MANAGER,
  ].includes(normalizedRole as any);

  const now = new Date();
  const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Round up to nearest 5 minutes for default selection
  const roundedMinute = Math.ceil(currentMinute / 5) * 5;
  const initialMinute = roundedMinute === 60 ? '00' : String(roundedMinute).padStart(2, '0');
  const initialHourRaw = roundedMinute === 60 ? currentHour + 1 : currentHour;
  
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(todayStr);
  const [hour, setHour] = useState(initialHourRaw % 12 === 0 ? '12' : String(initialHourRaw % 12));
  const [minute, setMinute] = useState(initialMinute);
  const [ampm, setAmpm] = useState(initialHourRaw >= 12 && initialHourRaw < 24 ? 'PM' : 'AM');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [appointmentType] = useState<'Appointment' | 'Walk-in'>('Appointment');

  // Client search & quick add state
  const [searchClients, { isFetching: isSearchingClients }] = useLazySearchAppointmentClientsQuery();
  const [checkClientPhone] = useLazyCheckAppointmentClientPhoneQuery();
  const [triggerGenerateId, { isLoading: isGeneratingId }] = useLazyGenerateAppointmentClientIdQuery();
  const [createClient, { isLoading: isCreatingClient }] = useCreateAppointmentClientMutation();

  const handleGenerateClientFormId = async () => {
    try {
      const res = await triggerGenerateId().unwrap();
      if (res.data?.client_id) {
        setClientPhoneError('');
        setClientForm((prev) => ({ ...prev, phone: res.data.client_id }));
        return;
      }
    } catch {
      // fallback
    }
    const fallbackId = generateLocalClientId();
    setClientPhoneError('');
    setClientForm((prev) => ({ ...prev, phone: fallbackId }));
  };

  const handleGenerateDirectId = async () => {
    try {
      const res = await triggerGenerateId().unwrap();
      if (res.data?.client_id) {
        setPhone(res.data.client_id);
        return;
      }
    } catch {
      // fallback
    }
    const fallbackId = generateLocalClientId();
    setPhone(fallbackId);
  };

  const [clientSearchResults, setClientSearchResults] = useState<AppointmentClient[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasClientSearched, setHasClientSearched] = useState(false);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    email: '',
    gender: '',
    dob: '',
    anniversary_date: '',
    is_member: false,
  });
  const [clientPhoneError, setClientPhoneError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const isProgrammaticChange = useRef(false);

  const debouncedClientSearch = useDebouncedSearch(customerName, 250);

  useEffect(() => {
    if (isProgrammaticChange.current) {
      isProgrammaticChange.current = false;
      return;
    }

    const term = debouncedClientSearch.trim();
    if (!term) {
      setClientSearchResults([]);
      setHasClientSearched(false);
      setShowDropdown(false);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const response = await searchClients({ search: term }).unwrap();
        setClientSearchResults(response.data ?? []);
        setHasClientSearched(true);
        setShowDropdown(true);
        setHighlightedIndex(-1);
      } catch {
        setClientSearchResults([]);
        setHasClientSearched(true);
        setShowDropdown(true);
        setHighlightedIndex(-1);
      }
    };

    void fetchSuggestions();
  }, [debouncedClientSearch, searchClients]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const applyClientSelection = (client: AppointmentClient) => {
    isProgrammaticChange.current = true;
    setCustomerName(client.name || '');
    setPhone(client.phone || '');
    setShowDropdown(false);
    setClientSearchResults([]);
    setHasClientSearched(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prevIndex) =>
        prevIndex < clientSearchResults.length - 1 ? prevIndex + 1 : 0
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : clientSearchResults.length - 1
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < clientSearchResults.length) {
        applyClientSelection(clientSearchResults[highlightedIndex]);
      } else {
        setShowDropdown(false);
      }
    } else if (event.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const prefillQuickAddFromSearch = (term: string) => {
    const digits = term.replace(/\D/g, '');
    const looksLikePhone = digits.length >= 6 && /^[\d\s+\-()]+$/.test(term);
    setClientForm((prev) => ({
      ...prev,
      name: looksLikePhone ? prev.name : term,
      phone: looksLikePhone ? term.trim() : prev.phone,
    }));
    setClientPhoneError('');
    setQuickAddOpen(true);
  };

  const handleClientPhoneBlur = async () => {
    const phoneVal = clientForm.phone.trim();
    if (phoneVal.length < 6) {
      setClientPhoneError('');
      return;
    }
    try {
      const result = await checkClientPhone({ phone: phoneVal }).unwrap();
      if (result.data?.exists && result.data.message) {
        setClientPhoneError(result.data.message);
      } else {
        setClientPhoneError('');
      }
    } catch {
      setClientPhoneError('');
    }
  };

  const handleCreateClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientForm.name.trim() || !clientForm.phone.trim()) {
      showToast('warning', 'Name and phone number are required');
      return;
    }
    if (!clientForm.gender) {
      showToast('warning', 'Gender is required');
      return;
    }
    try {
      const phoneCheck = await checkClientPhone({ phone: clientForm.phone.trim() }).unwrap();
      if (phoneCheck.data?.exists && phoneCheck.data.message) {
        setClientPhoneError(phoneCheck.data.message);
        showToast('error', phoneCheck.data.message);
        return;
      }
      if (phoneCheck.data?.valid === false && phoneCheck.data?.message) {
        setClientPhoneError(phoneCheck.data.message);
        showToast('error', phoneCheck.data.message);
        return;
      }
      const response = await createClient({
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim(),
        email: clientForm.email.trim() || undefined,
        gender: clientForm.gender,
        dob: clientForm.dob || undefined,
        anniversary_date: clientForm.anniversary_date || undefined,
        ...(allowMembership ? { is_member: Boolean(clientForm.is_member) } : {}),
      }).unwrap();

      if (response.data) {
        isProgrammaticChange.current = true;
        setCustomerName(response.data.name || '');
        setPhone(response.data.phone || '');
        setClientForm({ name: '', phone: '', email: '', gender: '', dob: '', anniversary_date: '', is_member: false });
        setClientPhoneError('');
        setQuickAddOpen(false);
        setShowDropdown(false);
        showToast('success', 'Client added');
      }
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to add client');
      setClientPhoneError(message);
      showToast('error', message);
    }
  };

  const [createQuick, { isLoading }] = useCreateQuickAppointmentMutation();

  if (!canCreate) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-4 text-center text-sm text-[var(--color-text-secondary)] shadow-soft">
        Quick appointment creation is restricted to Managers and Salon Owners.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      showToast('error', 'Customer name is required');
      return;
    }
    if (!phone.trim() || phone.trim().length < 5) {
      showToast('error', 'Valid mobile number is required');
      return;
    }
    if (!salonId) {
      showToast('error', 'Salon ID is missing');
      return;
    }

    try {
      let h24 = parseInt(hour, 10);
      if (ampm === 'AM' && h24 === 12) h24 = 0;
      if (ampm === 'PM' && h24 < 12) h24 += 12;
      const appointmentTime24 = `${String(h24).padStart(2, '0')}:${minute.padStart(2, '0')}`;

      await createQuick({
        salon_id: salonId,
        customer_name: customerName.trim(),
        phone: phone.trim(),
        appointment_date: appointmentDate,
        appointment_time: appointmentTime24,
        notes: notes.trim() || undefined,
        type: appointmentType,
      }).unwrap();

      showToast('success', `Appointment recorded for ${customerName}`);
      setCustomerName('');
      setPhone('');
      setNotes('');
      setShowNotes(false);
      setAppointmentDate(todayStr);
      const n = new Date();
      const nH = n.getHours();
      const nM = n.getMinutes();
      const roundM = Math.ceil(nM / 5) * 5;
      const initialM = roundM === 60 ? '00' : String(roundM).padStart(2, '0');
      const initialH = roundM === 60 ? nH + 1 : nH;
      setHour(initialH % 12 === 0 ? '12' : String(initialH % 12));
      setMinute(initialM);
      setAmpm(initialH >= 12 && initialH < 24 ? 'PM' : 'AM');
      if (onAppointmentCreated) {
        onAppointmentCreated();
      }
    } catch (err: any) {
      showToast('error', getApiErrorMessage(err, 'Failed to create appointment'));
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-brand-gold)]/10 text-[var(--color-brand-gold-dark)]">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--color-text-primary)] text-base">Quick Appointment Entry</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">Fast register entry for upcoming customer visits</p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            if (!quickAddOpen) {
              prefillQuickAddFromSearch(customerName.trim());
            } else {
              setQuickAddOpen(false);
            }
          }}
        >
          {quickAddOpen ? 'Close Add Client' : 'Add Client'}
        </Button>
      </div>

      {quickAddOpen && (
        <form onSubmit={handleCreateClient} className="mb-5 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)]/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-[var(--color-text-primary)]">Quick add client</h4>
            <button
              type="button"
              onClick={() => setQuickAddOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              ✕ Close
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Name *"
              value={clientForm.name}
              onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })}
              required
            />
            <div>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Phone / Mobile *"
                  value={clientForm.phone}
                  onChange={(event) => {
                    setClientPhoneError('');
                    setClientForm({ ...clientForm, phone: event.target.value });
                  }}
                  onBlur={() => {
                    void handleClientPhoneBlur();
                  }}
                  className={cn('flex-1', clientPhoneError ? 'border-red-400' : undefined)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateClientFormId}
                  disabled={isGeneratingId}
                  className="whitespace-nowrap px-2 text-xs font-semibold"
                >
                  Generate ID
                </Button>
              </div>
              {clientPhoneError && (
                <p className="mt-1 text-xs text-red-500">{clientPhoneError}</p>
              )}
            </div>
            <Input
              placeholder="Email optional"
              value={clientForm.email}
              onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })}
            />
            <div className="flex items-end gap-3 md:col-span-2">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Gender *</label>
                <Select
                  value={clientForm.gender}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, gender: event.target.value })
                  }
                  options={clientGenderOptions}
                  placeholder="Select Gender"
                  required
                />
              </div>
              {allowMembership && (
                <label className="mb-2 flex shrink-0 items-center gap-2 text-sm text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={clientForm.is_member}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, is_member: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)]"
                  />
                  Member
                </label>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Birthday (DOB)</label>
              <Input
                type="date"
                value={clientForm.dob}
                onChange={(event) => setClientForm({ ...clientForm, dob: event.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Anniversary Date</label>
              <Input
                type="date"
                value={clientForm.anniversary_date}
                onChange={(event) => setClientForm({ ...clientForm, anniversary_date: event.target.value })}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setQuickAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isCreatingClient}>
              Save client
            </Button>
          </div>
        </form>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2 relative" ref={dropdownRef}>
          <label className="mb-1 block font-semibold text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
            Customer Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Input
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                if (hasClientSearched) {
                  setHasClientSearched(false);
                  setClientSearchResults([]);
                }
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (clientSearchResults.length > 0) setShowDropdown(true);
              }}
              placeholder="Client Name or Phone"
              required
              className="w-full"
            />
            {isSearchingClients && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                <svg className="animate-spin h-4 w-4 text-[var(--color-brand-gold)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
            {showDropdown && (clientSearchResults.length > 0 || (hasClientSearched && customerName.trim().length > 0)) && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[var(--color-border-soft)] rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-[var(--color-border-soft)]">
                {clientSearchResults.length === 0 ? (
                  <div className="p-3 text-center text-sm text-[var(--color-text-secondary)]">
                    No clients found
                    {!quickAddOpen && (
                      <button
                        type="button"
                        className="mt-2 block w-full text-[var(--color-brand-gold)] font-medium hover:underline text-center text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          prefillQuickAddFromSearch(customerName.trim());
                          setShowDropdown(false);
                        }}
                      >
                        + Add New Client
                      </button>
                    )}
                  </div>
                ) : (
                  clientSearchResults.map((client, index) => (
                    <div
                      key={client.id}
                      onClick={() => applyClientSelection(client)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={cn(
                        "p-3 cursor-pointer transition text-left flex justify-between items-center",
                        index === highlightedIndex ? "bg-amber-50" : "bg-white"
                      )}
                    >
                      <div>
                        <span className="font-semibold text-[var(--color-text-primary)] text-sm block">
                          {client.name}
                        </span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{client.phone}</span>
                      </div>
                      {client.is_member && (
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          Member
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="mb-1 flex items-center justify-between">
            <label className="block font-semibold text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
              Mobile No. <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleGenerateDirectId}
              disabled={isGeneratingId}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-brand-gold-dark)] hover:underline focus:outline-none"
              title="Generate Client ID"
            >
              <Sparkles className="h-2.5 w-2.5" />
              Gen ID
            </button>
          </div>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile or CL-XXXXXX"
            required
            className="w-full"
          />
        </div>

        <div className="lg:col-span-1">
          <label className="mb-1 block font-semibold text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
            Date <span className="text-red-500">*</span>
          </label>
          <Input
            type="date"
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div className="lg:col-span-1">
          <label className="mb-1 block font-semibold text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
            Time <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-1">
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="flex-1 min-w-0 rounded-xl border border-[var(--color-border-soft)] bg-white px-1 py-2 text-center text-sm outline-none transition-all focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="text-[var(--color-text-secondary)] font-bold">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="flex-1 min-w-0 rounded-xl border border-[var(--color-border-soft)] bg-white px-1 py-2 text-center text-sm outline-none transition-all focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            >
              {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={ampm}
              onChange={(e) => setAmpm(e.target.value)}
              className="flex-none rounded-xl border border-[var(--color-border-soft)] bg-white px-2 py-2 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        <div className="flex items-end lg:col-span-1">
          <Button
            type="submit"
            isLoading={isLoading}
            variant="primary"
            className="w-full justify-center"
          >
            Save Booking
          </Button>
        </div>

        <div className="sm:col-span-2 lg:col-span-6">
          {!showNotes && !notes ? (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-brand-gold-dark)] hover:underline focus:outline-none transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              + Add optional notes
            </button>
          ) : (
            <div className="relative flex items-center">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes (e.g. preferred stylist, special request)"
                className="w-full text-xs pr-8"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setNotes('');
                  setShowNotes(false);
                }}
                className="absolute right-2 text-gray-400 hover:text-gray-600 p-1"
                title="Clear & close notes"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
