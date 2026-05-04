import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt?: string | Date;
  role?: 'registered' | 'premium';
}

/**
 * Token Service - Maneja almacenamiento y recuperación de tokens
 */
@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'user_profile';
  private readonly authStateSubject = new BehaviorSubject<boolean>(this.hasStoredSession());

  public readonly authState$ = this.authStateSubject.asObservable();

  /**
   * Obtiene el token de acceso
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Obtiene el token de refresco
   */
  getRefreshToken(): string | null {
    return null;
  }

  /**
   * Guarda los tokens
   */
  setTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    this.authStateSubject.next(true);
  }

  /**
   * Guarda el perfil del usuario
   */
  setUserProfile(user: UserProfile): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Obtiene el perfil del usuario
   */
  getUserProfile(): UserProfile | null {
    const user = localStorage.getItem(this.USER_KEY);
    if (!user) {
      return null;
    }

    try {
      return JSON.parse(user) as UserProfile;
    } catch {
      return null;
    }
  }

  setUserRole(role: 'registered' | 'premium'): void {
    const profile = this.getUserProfile();
    if (!profile) {
      return;
    }

    const updated = {
      ...profile,
      role
    };

    this.setUserProfile(updated);
    try {
      console.info('[TokenService] setUserRole -> updated role to', role, 'for user', profile.id);
    } catch (e) {
      // noop
    }

    // Notify any subscribers that auth/profile state may have changed
    try {
      this.authStateSubject.next(this.hasStoredSession());
    } catch (e) {
      // noop
    }
  }

  getUserRole(): 'registered' | 'premium' {
    return this.getUserProfile()?.role === 'premium' ? 'premium' : 'registered';
  }

  isPremiumUser(): boolean {
    return this.getUserRole() === 'premium';
  }

  /**
   * Verifica si hay un token válido
   */
  hasToken(): boolean {
    return !!this.getToken();
  }

  /**
   * Limpia todos los tokens y datos de usuario
   */
  clearTokens(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.authStateSubject.next(false);
  }

  /**
   * Realiza logout del usuario
   */
  logout(): void {
    this.clearTokens();
  }

  /**
   * Decodifica el token JWT (sin validación)
   */
  decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
      const decoded = JSON.parse(atob(base64Url + padding));
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verifica si el token está expirado
   */
  isTokenExpired(token?: string): boolean {
    const tkn = token || this.getToken();
    if (!tkn) return true;

    const decoded = this.decodeToken(tkn);
    if (!decoded || !decoded.exp) return true;

    const expirationDate = new Date(decoded.exp * 1000);
    return expirationDate <= new Date();
  }

  private hasStoredSession(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY) && !!localStorage.getItem(this.USER_KEY);
  }
}
