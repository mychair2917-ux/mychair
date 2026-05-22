export interface CreateInvitationRequest {
  salon_name: string;
  slug: string;
  email: string;
  username: string;
  address: string;
}

export interface CreateInvitationResponseData {
  salon_id: string;
  owner_id: string;
  salon_name: string;
  email: string;
  invitation_sent: boolean;
}

export interface ValidateInvitationResponseData {
  salon_name: string;
  email: string;
  username: string;
  expires_at: string;
  is_valid: boolean;
}

export interface CreatePasswordRequest {
  token: string;
  password: string;
  confirm_password: string;
}

export interface CreatePasswordResponseData {
  owner_id: string;
  email: string;
}
