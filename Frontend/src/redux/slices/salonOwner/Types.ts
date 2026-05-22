export interface SalonOwnerLoginRequest {
  email: string;
  password: string;
}

export interface SalonOwnerLoginResponseData {
  access_token: string;
  refresh_token: string;
  role: string;
  salon_id: string;
  email: string;
  username: string;
}

export interface SalonOwnerProfileData {
  salon_name: string;
  slug: string;
  email: string;
  username: string;
  address: string;
}
