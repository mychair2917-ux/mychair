import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
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
import { cn } from '../../utils/cn';
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

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
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
    if (!validateProfile()) return;

    const payload: UpdateProfileRequest = {
      first_name: formState.first_name.trim(),
      last_name: formState.last_name.trim(),
      email: formState.email.trim(),
      phone: formState.phone.trim(),
      alternate_phone: formState.alternate_phone.trim() || null,
      gender: formState.gender || null,
      dob: formState.dob || null,
      address: formState.address.trim() || null,
      city: formState.city.trim() || null,
      state: formState.state.trim() || null,
      country: formState.country.trim() || null,
      pincode: formState.pincode.trim() || null,
      department: isProfessionalEditable ? formState.department.trim() || null : undefined,
      designation: isProfessionalEditable ? formState.designation.trim() || null : undefined,
      shift: isProfessionalEditable ? formState.shift.trim() || null : undefined,
      branch_id: isProfessionalEditable ? formState.branch_id.trim() || null : undefined,
      branch_name: isProfessionalEditable ? formState.branch_name.trim() || null : undefined,
      employee_code: isProfessionalEditable ? formState.employee_code.trim() || null : undefined,
      joining_date: isProfessionalEditable ? formState.joining_date || null : undefined,
      status: isProfessionalEditable ? formState.status || null : undefined,
      is_active: isProfessionalEditable ? formState.is_active : undefined,
    };

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
      <div className="p-6 md:p-8">
        <PageLoader label="Loading your profile workspace..." />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="p-6 md:p-8">
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
      <CommonCard
        className="overflow-hidden"
        bodyClassName="p-0"
      >
        <div className="bg-gradient-to-r from-[#1f172a] via-[#3b274f] to-[#8b6b33] px-6 py-8 text-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-28 w-28 shrink-0 rounded-full border-4 border-white/30 bg-white/10 p-1 shadow-xl">
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt={displayName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-3xl font-semibold uppercase">
                    {(displayName[0] || 'U').toUpperCase()}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <h1 className="text-3xl font-semibold tracking-[0.01em]">{displayName}</h1>
                  <p className="mt-1 text-sm text-white/75">
                    {(profile.role || 'user').replace(/_/g, ' ')}{profile.designation ? ` • ${profile.designation}` : ''}
                  </p>
                </div>

                <div className="grid gap-2 text-sm text-white/85 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <IdCard className="h-4 w-4 text-[var(--color-brand-gold-light)]" />
                    <span>Employee ID: {profile.employee_id || profile.employee_code || '---'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[var(--color-brand-gold-light)]" />
                    <span>{profile.branch_name || profile.salon_name || 'Salon not assigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[var(--color-brand-gold-light)]" />
                    <span>Status: {profile.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[var(--color-brand-gold-light)]" />
                    <span>Joined: {formatDateDMY(profile.joining_date)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex flex-col gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
                  <Camera className="h-4 w-4" />
                  <span>{avatarFile ? 'Change selected image' : 'Choose profile image'}</span>
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarSelect} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="!border-white/20 !bg-white !text-[var(--color-text-primary)]"
                    onClick={handleAvatarUpload}
                    disabled={!avatarFile || isAvatarBusy}
                    isLoading={isUploadingAvatar}
                  >
                    Save image
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="!text-white hover:!bg-white/10"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                    }}
                    disabled={!avatarPreview || isAvatarBusy}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="!text-white hover:!bg-white/10"
                    onClick={handleAvatarRemove}
                    disabled={(!profile.avatar && !avatarPreview) || isAvatarBusy}
                    isLoading={isRemovingAvatar}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Remove
                  </Button>
                </div>
                <p className="text-xs text-white/70">PNG or JPG, maximum 2MB.</p>
              </div>
            </div>
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

          <CommonCard
            title="Professional Information"
            subtitle={isProfessionalEditable ? 'Authorized role detected. You can update assignment metadata.' : 'These fields are read-only for your access level.'}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ProfileField icon={Briefcase} label="Role" value={profile.role.replace(/_/g, ' ')} />
              <ProfileField icon={IdCard} label="Employee Code" value={profile.employee_code || profile.employee_id || '---'}>
                <Input
                  value={formState.employee_code}
                  onChange={(e) => handleFieldChange('employee_code', e.target.value)}
                  disabled={!isProfessionalEditable}
                />
              </ProfileField>
              <ProfileField icon={Building2} label="Assigned Branch" value={profile.branch_name || profile.salon_name || '---'}>
                <Input
                  value={formState.branch_name}
                  onChange={(e) => handleFieldChange('branch_name', e.target.value)}
                  disabled={!isProfessionalEditable}
                />
              </ProfileField>
              <ProfileField icon={Briefcase} label="Department" value={profile.department || '---'}>
                <Input
                  value={formState.department}
                  onChange={(e) => handleFieldChange('department', e.target.value)}
                  disabled={!isProfessionalEditable}
                />
              </ProfileField>
              <ProfileField icon={UserRound} label="Designation" value={profile.designation || '---'}>
                <Input
                  value={formState.designation}
                  onChange={(e) => handleFieldChange('designation', e.target.value)}
                  disabled={!isProfessionalEditable}
                />
              </ProfileField>
              <ProfileField icon={CalendarDays} label="Shift" value={profile.shift || '---'}>
                <Input
                  value={formState.shift}
                  onChange={(e) => handleFieldChange('shift', e.target.value)}
                  disabled={!isProfessionalEditable}
                />
              </ProfileField>
              <ProfileField icon={CalendarDays} label="Joining Date" value={formatDateDMY(profile.joining_date)}>
                <div className="space-y-2">
                  <Input
                    type="date"
                    value={formState.joining_date}
                    onChange={(e) => handleFieldChange('joining_date', e.target.value)}
                    disabled={!isProfessionalEditable}
                  />
                  <p className="text-xs text-[var(--color-text-secondary)]">{formatDateDMY(formState.joining_date)}</p>
                </div>
              </ProfileField>
              <ProfileField icon={ShieldCheck} label="Account Status" value={profile.status === 'ACTIVE' ? 'Active' : 'Inactive'}>
                <Select
                  value={formState.status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  options={statusOptions}
                  disabled={!isProfessionalEditable}
                />
              </ProfileField>
            </div>
          </CommonCard>
        </div>

        <div className="space-y-6">
          <CommonCard title="Account Settings" subtitle="Security and account visibility">
            <div className="space-y-4">
              <InfoRow icon={Mail} label="Primary Email" value={profile.email} />
              <InfoRow icon={Phone} label="Last Login" value={profile.last_login ? `${formatDateDMY(profile.last_login)} • ${new Date(profile.last_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '---'} />
              <InfoRow icon={MapPin} label="Session Context" value="Current authenticated browser session" />
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

const ProfileField: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  children?: React.ReactNode;
}> = ({ icon: Icon, label, value, children }) => (
  <div className="rounded-2xl border border-[var(--color-border-soft)] p-4">
    <div className="mb-3 flex items-center gap-2 text-[var(--color-text-primary)]">
      <Icon className="h-4 w-4 text-[var(--color-brand-gold-dark)]" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
    <p className={cn('mb-3 text-sm text-[var(--color-text-secondary)]', children && 'mb-4')}>{value}</p>
    {children}
  </div>
);

export default Profile;
