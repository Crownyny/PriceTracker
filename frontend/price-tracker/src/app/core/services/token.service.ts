import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { UserProfile } from '../../shared/models/auth.model';

export type { UserProfile };

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'user_profile';
  private readonly authStateSubject = new BehaviorSubject<boolean>(this.hasStoredSession());
  private readonly roleSubject = new BehaviorSubject<'registered' | 'premium'>(
    this.getUserProfile()?.role === 'premium' ? 'premium' : 'registered'
  );

  public readonly authState$ = this.authStateSubject.asObservable();
  public readonly role$ = this.roleSubject.asObservable();

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setTokens(accessToken: string): void {
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    this.authStateSubject.next(true);
  }

  setUserProfile(user: UserProfile): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  getUserProfile(): UserProfile | null {
    const stored = localStorage.getItem(this.USER_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as UserProfile;
    } catch {
      return null;
    }
  }

  setUserRole(role: 'registered' | 'premium'): void {
    const profile = this.getUserProfile();
    if (!profile) return;

    this.setUserProfile({ ...profile, role });
    console.info('[TokenService] rol actualizado a', role, 'para el usuario', profile.id);
    this.authStateSubject.next(this.hasStoredSession());
    this.roleSubject.next(role);
  }

  getUserRole(): 'registered' | 'premium' {
    return this.getUserProfile()?.role === 'premium' ? 'premium' : 'registered';
  }

  isPremiumUser(): boolean {
    return this.getUserRole() === 'premium';
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  clearTokens(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.authStateSubject.next(false);
  }

  /** Decodifica el payload del token JWT sin verificar firma. */
  decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
      return JSON.parse(atob(base64Url + padding));
    } catch {
      return null;
    }
  }

  isTokenExpired(token?: string): boolean {
    const tkn = token ?? this.getToken();
    if (!tkn) return true;

    const decoded = this.decodeToken(tkn);
    if (!decoded?.exp) return true;

    return new Date(decoded.exp * 1000) <= new Date();
  }

  private hasStoredSession(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY) && !!localStorage.getItem(this.USER_KEY);
  }
}