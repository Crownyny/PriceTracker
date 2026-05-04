/**
 * Authentication Models
 */

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt: Date;
  role?: UserRole;
}

export type UserRole = 'registered' | 'premium';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt?: Date | string;
  role: UserRole;
}

export interface TokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}
