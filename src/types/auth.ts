// Auth Types
export interface User {
  id: string;
  email: string;
  username?: string;
  phone?: string;
  full_name: string;
  user_type: string;
  profile_photo?: string;
  date_of_birth?: string;
  gender?: string;
  is_active?: boolean;
  is_verified: boolean;
  last_login?: string;
  login_type: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  requires_verification?: boolean;
  verification_token?: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  user_type?: string;
  gender?: string;
  date_of_birth?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OTPVerifyRequest {
  email: string;
  otp_code: string;
}

export interface ResendOTPRequest {
  email: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
  requires_verification?: boolean;
  verification_token?: string;
}

export interface OTPVerifyResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ResendOTPResponse {
  message: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface VerifyResetPasswordRequest {
  email: string;
  otp_code: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface VerifyResetPasswordResponse {
  message: string;
}

export interface GoogleOAuthRequest {
  email: string;
  full_name: string;
  profile_photo: string;
  google_id: string;
}
