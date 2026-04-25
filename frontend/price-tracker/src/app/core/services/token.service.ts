import { Injectable } from '@angular/core';

/**
 * Token Service - Maneja almacenamiento y recuperación de tokens
 */
@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'user_profile';

  /**
   * Obtiene el token de acceso
   */
  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
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
    sessionStorage.setItem(this.TOKEN_KEY, accessToken);
  }

  /**
   * Guarda el perfil del usuario
   */
  setUserProfile(user: any): void {
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Obtiene el perfil del usuario
   */
  getUserProfile(): any {
    const user = sessionStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
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
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
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
}
