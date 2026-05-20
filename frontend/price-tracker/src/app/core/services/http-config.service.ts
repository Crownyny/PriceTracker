import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from '../config/runtime-config.service';

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

@Injectable({
  providedIn: 'root'
})
export class HttpConfigService {
  private readonly API_VERSION = 'v1';

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  getApiBaseUrl(): string {
    return this.runtimeConfig.getApiUrl();
  }

  getApiUrl(): string {
    return `${this.getApiBaseUrl()}/${this.API_VERSION}`;
  }

  buildUrl(endpoint: string): string {
    return `${this.getApiUrl()}${endpoint}`;
  }

  getHeaders(authToken?: string): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (authToken) {
      headers = headers.set('Authorization', `Bearer ${authToken}`);
    }

    return headers;
  }

  get<T>(endpoint: string, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.get<T>(this.buildUrl(endpoint), options);
  }

  post<T>(endpoint: string, body: unknown, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.post<T>(this.buildUrl(endpoint), body, options);
  }

  put<T>(endpoint: string, body: unknown, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.put<T>(this.buildUrl(endpoint), body, options);
  }

  patch<T>(endpoint: string, body: unknown, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.patch<T>(this.buildUrl(endpoint), body, options);
  }

  delete<T>(endpoint: string, options?: JsonBodyRequestOptions): Observable<T> {
    return this.http.delete<T>(this.buildUrl(endpoint), options);
  }
}