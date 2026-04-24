import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';
import { Observable } from 'rxjs';

type JsonBodyRequestOptions = {
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  params?:
    | HttpParams
    | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
  reportProgress?: boolean;
  withCredentials?: boolean;
  transferCache?: { includeHeaders?: string[] } | boolean;
};

/**
 * HTTP Config Service - Gestiona la configuración base de las peticiones HTTP
 */
@Injectable({
  providedIn: 'root'
})
export class HttpConfigService {
  private readonly API_BASE_URL = 'http://localhost:8080/api';
  private readonly API_VERSION = 'v1';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene la URL base de la API
   */
  getApiBaseUrl(): string {
    return this.API_BASE_URL;
  }

  /**
   * Obtiene la URL versioned de la API
   */
  getApiUrl(): string {
    return `${this.API_BASE_URL}/${this.API_VERSION}`;
  }

  /**
   * Construye una URL completa de endpoint
   */
  buildUrl(endpoint: string): string {
    return `${this.getApiUrl()}${endpoint}`;
  }

  /**
   * Obtiene los headers por defecto con autenticación
   */
  getHeaders(authToken?: string): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (authToken) {
      headers = headers.set('Authorization', `Bearer ${authToken}`);
    }

    return headers;
  }

  /**
   * Realiza una petición GET
   */
  get<T>(endpoint: string, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.get<T>(this.buildUrl(endpoint), options);
  }

  /**
   * Realiza una petición POST
   */
  post<T>(endpoint: string, body: unknown, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.post<T>(this.buildUrl(endpoint), body, options);
  }

  /**
   * Realiza una petición PUT
   */
  put<T>(endpoint: string, body: unknown, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.put<T>(this.buildUrl(endpoint), body, options);
  }

  /**
   * Realiza una petición PATCH
   */
  patch<T>(endpoint: string, body: unknown, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.patch<T>(this.buildUrl(endpoint), body, options);
  }

  /**
   * Realiza una petición DELETE
   */
  delete<T>(endpoint: string, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.delete<T>(this.buildUrl(endpoint), options);
  }
}
