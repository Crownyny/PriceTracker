import { Injectable } from '@angular/core';

/**
 * Token Service - Maneja almacenamiento y recuperación de tokens
 */
@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly USER_KEY = 'user_profile';

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
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Guarda los tokens
   */
  setTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  /**
   * Guarda el perfil del usuario
   */
  setUserProfile(user: any): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Obtiene el perfil del usuario
   */
  getUserProfile(): any {
    const user = localStorage.getItem(this.USER_KEY);
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
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * Decodifica el token JWT (sin validación)
   */
  decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const decoded = JSON.parse(atob(parts[1]));
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
