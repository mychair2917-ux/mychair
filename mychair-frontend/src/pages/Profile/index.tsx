import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { Button, CommonCard, EmptyState, FormField, Input, PageLoader, Select } from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import { useAppSelector } from '../../redux/hooks';
import {
  useChangePasswordMutation,
  useGetProfileQuery,
  useRemoveAvatarMutation,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from '../../redux/slices/profile/profileApi';
import { ProfileData, UpdateProfileRequest } from '../../redux/slices/profile/Types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatDateDMY, toDateInputValue } from '../../utils/utilities';

type ProfileFormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  alternate_phone: string;
  gender: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  department: string;
  designation: string;
  shift: string;
  branch_id: string;
  branch_name: string;
  employee_code: string;
  joining_date: string;
  status: string;
  is_active: boolean;
};

type PasswordFormState = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

type FormErrors = Partial<Record<keyof ProfileFormState | keyof PasswordFormState | 'avatar', string>>;

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];



const createFormState = (profile?: ProfileData | null): ProfileFormState => ({
  first_name: profile?.first_name ?? '',
  last_name: profile?.last_name ?? '',
  email: profile?.email ?? '',
  phone: profile?.phone ?? '',
  alternate_phone: profile?.alternate_phone ?? '',
  gender: profile?.gender ?? '',
  dob: toDateInputValue(profile?.dob ?? null),
  address: profile?.address ?? '',
  city: profile?.city ?? '',
  state: profile?.state ?? '',
  country: profile?.country ?? '',
  pincode: profile?.pincode ?? '',
  department: profile?.department ?? '',
  designation: profile?.designation ?? '',
  shift: profile?.shift ?? '',
  branch_id: profile?.branch_id ?? '',
  branch_name: profile?.branch_name ?? '',
  employee_code: profile?.employee_code ?? '',
  joining_date: toDateInputValue(profile?.joining_date ?? null),
  status: profile?.status ?? 'ACTIVE',
  is_active: profile?.is_active ?? true,
});

const initialPasswordState: PasswordFormState = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

const phonePattern = /^[0-9+\-\s()]{7,20}$/;

const Profile: React.FC = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const { data, isLoading, isFetching, isError, refetch } = useGetProfileQuery();
  const [updateProfile, { isLoading: isSavingProfile }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();
  const [uploadAvatar, { isLoading: isUploadingAvatar }] = useUploadAvatarMutation();
  const [removeAvatar, { isLoading: isRemovingAvatar }] = useRemoveAvatarMutation();

  const profile = data?.data;

  const [formState, setFormState] = useState<ProfileFormState>(createFormState(profile));
  const [passwordState, setPasswordState] = useState<PasswordFormState>(initialPasswordState);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<FormErrors>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    if (profile) {
      setFormState(createFormState(profile));
      setFormErrors({});
      setAvatarPreview(null);
      setAvatarFile(null);
    }
  }, [profile]);

  const displayAvatar = avatarPreview || profile?.avatar || authUser?.avatar || null;
  const displayName = profile?.full_name || [authUser?.first_name, authUser?.last_name].filter(Boolean).join(' ') || authUser?.email || 'User';

  const isProfessionalEditable = Boolean(profile?.can_edit_professional_info);
  const isAvatarBusy = isUploadingAvatar || isRemovingAvatar;

  const hasProfileChanges = useMemo(() => {
    if (!profile) return false;
    const baseline = createFormState(profile);
    return JSON.stringify(formState) !== JSON.stringify(baseline);
  }, [formState, profile]);

  const handleFieldChange = <K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) => {
    setFormState((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handlePasswordFieldChange = <K extends keyof PasswordFormState>(field: K, value: PasswordFormState[K]) => {
    setPasswordState((current) => ({ ...current, [field]: value }));
    setPasswordErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateProfile = () => {
    const nextErrors: FormErrors = {};
    if (!formState.first_name.trim()) nextErrors.first_name = 'First name is required';
    if (!formState.last_name.trim()) nextErrors.last_name = 'Last name is required';
    if (!formState.email.trim()) nextErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) nextErrors.email = 'Enter a valid email address';
    if (!formState.phone.trim()) nextErrors.phone = 'Phone number is required';
    else if (!phonePattern.test(formState.phone.trim())) nextErrors.phone = 'Enter a valid phone number';
    if (formState.alternate_phone.trim() && !phonePattern.test(formState.alternate_phone.trim())) {
      nextErrors.alternate_phone = 'Enter a valid alternate phone number';
    }
    if (
      formState.alternate_phone.trim() &&
      formState.alternate_phone.trim() === formState.phone.trim()
    ) {
      nextErrors.alternate_phone = 'Alternate phone must be different from primary phone';
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validatePassword = () => {
    const nextErrors: FormErrors = {};
    if (!passwordState.current_password.trim()) nextErrors.current_password = 'Current password is required';
    if (!passwordState.new_password.trim()) nextErrors.new_password = 'New password is required';
    else if (passwordState.new_password.trim().length < 8) nextErrors.new_password = 'Password must be at least 8 characters';
    if (!passwordState.confirm_password.trim()) nextErrors.confirm_password = 'Please confirm the new password';
    if (
      passwordState.new_password.trim() &&
      passwordState.confirm_password.trim() &&
      passwordState.new_password !== passwordState.confirm_password
    ) {
      nextErrors.confirm_password = 'Passwords do not match';
    }
    if (
      passwordState.current_password.trim() &&
      passwordState.new_password.trim() &&
      passwordState.current_password === passwordState.new_password
    ) {
      nextErrors.new_password = 'New password must be different from current password';
    }
    setPasswordErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      showToast('error', 'Only PNG and JPEG images are allowed');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Avatar image must be 2MB or smaller');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setFormErrors((current) => ({ ...current, avatar: undefined }));
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    try {
      await uploadAvatar(avatarFile).unwrap();
      showToast('success', 'Profile image updated successfully');
      setAvatarFile(null);
      setAvatarPreview(null);
      refetch();
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to update profile image'));
    }
  };

  const handleAvatarRemove = async () => {
    try {
      await removeAvatar({ remove: true }).unwrap();
      showToast('success', 'Profile image removed successfully');
      setAvatarFile(null);
      setAvatarPreview(null);
      refetch();
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to remove profile image'));
    }
  };

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateProfile() || !profile) return;

    const baseline = createFormState(profile);
    const payload: UpdateProfileRequest = {};

    const assignIfChanged = <K extends keyof UpdateProfileRequest>(
      field: K,
      value: UpdateProfileRequest[K]
    ) => {
      const baselineValue = baseline[field as keyof ProfileFormState];
      if (JSON.stringify(value) !== JSON.stringify(baselineValue)) {
        payload[field] = value;
      }
    };

    assignIfChanged('first_name', formState.first_name.trim());
    assignIfChanged('last_name', formState.last_name.trim());
    assignIfChanged('email', formState.email.trim().toLowerCase());
    assignIfChanged('phone', formState.phone.trim());
    assignIfChanged('alternate_phone', formState.alternate_phone.trim() || null);
    assignIfChanged('gender', formState.gender || null);
    assignIfChanged('dob', formState.dob || null);
    assignIfChanged('address', formState.address.trim() || null);
    assignIfChanged('city', formState.city.trim() || null);
    assignIfChanged('state', formState.state.trim() || null);
    assignIfChanged('country', formState.country.trim() || null);
    assignIfChanged('pincode', formState.pincode.trim() || null);

    if (isProfessionalEditable) {
      assignIfChanged('department', formState.department.trim() || null);
      assignIfChanged('designation', formState.designation.trim() || null);
      assignIfChanged('shift', formState.shift.trim() || null);
      assignIfChanged('branch_id', formState.branch_id.trim() || null);
      assignIfChanged('branch_name', formState.branch_name.trim() || null);
      assignIfChanged('employee_code', formState.employee_code.trim() || null);
      assignIfChanged('joining_date', formState.joining_date || null);
      assignIfChanged('status', formState.status || null);
      assignIfChanged('is_active', formState.is_active);
    }

    if (Object.keys(payload).length === 0) {
      showToast('info', 'No profile changes to save');
      return;
    }

    try {
      await updateProfile(payload).unwrap();
      showToast('success', 'Profile updated successfully');
      refetch();
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to update profile'));
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validatePassword()) return;
    try {
      await changePassword(passwordState).unwrap();
      showToast('success', 'Password changed successfully');
      setPasswordState(initialPasswordState);
      setPasswordErrors({});
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to change password'));
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <PageLoader label="Loading your profile workspace..." />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <CommonCard>
          <EmptyState
            title="Unable to load profile"
            description="We could not fetch your profile right now. Please try again in a moment."
            action={
              <Button type="button" variant="primary" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        </CommonCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <CommonCard className="overflow-hidden">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-24 w-24 shrink-0 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-bg)] p-0.5 shadow-sm">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--color-border-soft)] text-2xl font-bold uppercase text-[var(--color-text-secondary)]">
                  {(displayName[0] || 'U').toUpperCase()}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{displayName}</h1>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                {(profile.role || 'user').replace(/_/g, ' ')}{profile.designation ? ` • ${profile.designation}` : ''}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-tertiary)] pt-1">
                {profile.employee_code || profile.employee_id ? (
                  <span>ID: {profile.employee_code || profile.employee_id}</span>
                ) : null}
                {profile.branch_name || profile.salon_name ? (
                  <span>• {profile.branch_name || profile.salon_name}</span>
                ) : null}
                <span>• Joined {formatDateDMY(profile.joining_date)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-bg)]">
              <Camera className="h-4 w-4 text-[var(--color-text-secondary)]" />
              <span>{avatarFile ? 'Change photo' : 'Upload photo'}</span>
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarSelect} />
            </label>

            {avatarFile && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={handleAvatarUpload}
                  disabled={isAvatarBusy}
                  isLoading={isUploadingAvatar}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarPreview(null);
                  }}
                  disabled={isAvatarBusy}
                >
                  Cancel
                </Button>
              </>
            )}

            {(profile.avatar || avatarPreview) && !avatarFile && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleAvatarRemove}
                disabled={isAvatarBusy}
                isLoading={isRemovingAvatar}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </CommonCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <CommonCard
            title="Personal Information"
            subtitle="Update your personal details and contact information."
            loading={isFetching && !profile}
          >
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="First Name" name="first_name" error={formErrors.first_name} touched={!!formErrors.first_name} required>
                  <Input id="first_name" value={formState.first_name} onChange={(e) => handleFieldChange('first_name', e.target.value)} />
                </FormField>
                <FormField label="Last Name" name="last_name" error={formErrors.last_name} touched={!!formErrors.last_name} required>
                  <Input id="last_name" value={formState.last_name} onChange={(e) => handleFieldChange('last_name', e.target.value)} />
                </FormField>
                <FormField label="Email" name="email" error={formErrors.email} touched={!!formErrors.email} required>
                  <Input id="email" type="email" value={formState.email} onChange={(e) => handleFieldChange('email', e.target.value)} />
                </FormField>
                <FormField label="Phone Number" name="phone" error={formErrors.phone} touched={!!formErrors.phone} required>
                  <Input id="phone" value={formState.phone} onChange={(e) => handleFieldChange('phone', e.target.value)} />
                </FormField>
                <FormField label="Alternate Phone" name="alternate_phone" error={formErrors.alternate_phone} touched={!!formErrors.alternate_phone}>
                  <Input id="alternate_phone" value={formState.alternate_phone} onChange={(e) => handleFieldChange('alternate_phone', e.target.value)} />
                </FormField>
                <FormField label="Gender" name="gender" error={formErrors.gender} touched={!!formErrors.gender}>
                  <Select id="gender" value={formState.gender} onChange={(e) => handleFieldChange('gender', e.target.value)} options={genderOptions} placeholder="Select gender" />
                </FormField>
                <FormField label="Date of Birth" name="dob" error={formErrors.dob} touched={!!formErrors.dob}>
                  <Input id="dob" type="date" value={formState.dob} onChange={(e) => handleFieldChange('dob', e.target.value)} />
                </FormField>
                <div className="rounded-2xl border border-dashed border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                  Date of birth: <span className="font-medium text-[var(--color-text-primary)]">{formatDateDMY(formState.dob)}</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Address" name="address" error={formErrors.address} touched={!!formErrors.address} className="md:col-span-2">
                  <textarea
                    id="address"
                    value={formState.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    rows={4}
                    className="w-full rounded-[7px] border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
                  />
                </FormField>
                <FormField label="City" name="city" error={formErrors.city} touched={!!formErrors.city}>
                  <Input id="city" value={formState.city} onChange={(e) => handleFieldChange('city', e.target.value)} />
                </FormField>
                <FormField label="State" name="state" error={formErrors.state} touched={!!formErrors.state}>
                  <Input id="state" value={formState.state} onChange={(e) => handleFieldChange('state', e.target.value)} />
                </FormField>
                <FormField label="Country" name="country" error={formErrors.country} touched={!!formErrors.country}>
                  <Input id="country" value={formState.country} onChange={(e) => handleFieldChange('country', e.target.value)} />
                </FormField>
                <FormField label="Pincode" name="pincode" error={formErrors.pincode} touched={!!formErrors.pincode}>
                  <Input id="pincode" value={formState.pincode} onChange={(e) => handleFieldChange('pincode', e.target.value)} />
                </FormField>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] px-4 py-3">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Your name, email, and avatar update across the application immediately after save.
                </p>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSavingProfile}
                  disabled={!hasProfileChanges && !isProfessionalEditable}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  Save profile
                </Button>
              </div>
            </form>
          </CommonCard>
        </div>

        <div className="space-y-6">
          <CommonCard title="Account Settings" subtitle="Security and account visibility">
            <div className="space-y-4">
              <InfoRow icon={Mail} label="Primary Email" value={profile.email} />
              <InfoRow icon={Phone} label="Last Login" value={profile.last_login ? `${formatDateDMY(profile.last_login)} • ${new Date(profile.last_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '---'} />
              
              <InfoRow icon={ShieldCheck} label="Account Status" value={profile.status === 'ACTIVE' ? 'Active' : 'Inactive'} />
            </div>
          </CommonCard>

          <CommonCard title="Change Password" subtitle="Use a strong password to keep your account secure.">
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <FormField label="Current Password" name="current_password" error={passwordErrors.current_password} touched={!!passwordErrors.current_password} required>
                <Input type="password" value={passwordState.current_password} onChange={(e) => handlePasswordFieldChange('current_password', e.target.value)} />
              </FormField>
              <FormField label="New Password" name="new_password" error={passwordErrors.new_password} touched={!!passwordErrors.new_password} required>
                <Input type="password" value={passwordState.new_password} onChange={(e) => handlePasswordFieldChange('new_password', e.target.value)} />
              </FormField>
              <FormField label="Confirm New Password" name="confirm_password" error={passwordErrors.confirm_password} touched={!!passwordErrors.confirm_password} required>
                <Input type="password" value={passwordState.confirm_password} onChange={(e) => handlePasswordFieldChange('confirm_password', e.target.value)} />
              </FormField>
              <Button type="submit" variant="primary" fullWidth isLoading={isChangingPassword}>
                Update password
              </Button>
            </form>
          </CommonCard>
        </div>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] px-4 py-3">
    <div className="rounded-2xl bg-white p-2 text-[var(--color-brand-gold-dark)] shadow-sm">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{value}</p>
    </div>
  </div>
);



export default Profile;
