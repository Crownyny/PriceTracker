import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, catchError, switchMap, throwError } from 'rxjs';
import { HttpConfigService } from '../../../core/services/http-config.service';
import { TokenService } from '../../../core/services/token.service';
import {
  Alert,
  AlertListResponse,
  CreateAlertRequest,
  UpdateAlertRequest,
  UpdateAlertStatusRequest,
  AlertResponse,
  AlertFrequency
} from '../../../shared/models/alert.model';

/**
 * Alert Service - Gestiona alertas de precios
 *
 * Fuente de verdad (Postman / enunciado):
 * - POST   /api/{userId}/alert?productId={productId}   body: { frequency }
 * - GET    /api/{alertId}/alert
 * - GET    /api/alert
 * - PUT    /api/{alertId}/alert                        body: { frequency }
 * - PATCH  /api/{alertId}/alert                        body: { isActive }
 * - DELETE /api/{alertId}/alert
 */
@Injectable({
  providedIn: 'root'
})
export class AlertService {
  constructor(
    private http: HttpClient,
    private httpConfig: HttpConfigService,
    private tokenService: TokenService
  ) {}

  private getApiBaseUrl(): string {
    return this.httpConfig.getApiBaseUrl();
  }

  private getCurrentUserId(): string {
    const profile = this.tokenService.getUserProfile();
    const userId = profile?.id || localStorage.getItem('userId') || '';
    if (!userId) {
      throw new Error('No hay userId disponible para operar alertas');
    }
    return userId;
  }

  private buildUserAlertUrl(userId: string): string {
    return `${this.getApiBaseUrl()}/${userId}/alert`;
  }

  private buildAlertByIdUrl(alertId: string): string {
    return `${this.getApiBaseUrl()}/${encodeURIComponent(alertId)}/alert`;
  }

  private normalizeFrequency(value?: string): AlertFrequency {
    const normalized = (value || '').toUpperCase();
    if (normalized === 'DAILY' || normalized === 'D1' || normalized === '1D') return 'daily';
    if (normalized === 'WEEKLY' || normalized === 'W1' || normalized === '1W') return 'weekly';
    return 'instant';
  }

  private toAlert(raw: any): Alert {
    return {
      id: raw.id ?? '',
      userId: raw.userId ?? '',
      productId: raw.productId ?? '',
      productRef: raw.productRef,
      targetPrice: raw.targetPrice ?? raw.target_price ?? 0,
      currency: raw.currency,
      condition: raw.condition,
      isActive: raw.isActive ?? false,
      frequency: this.normalizeFrequency(raw.frequency ?? raw.frecuency),
      notificationMethod: raw.notificationMethod,
      createdAt: raw.createdAt ?? raw.createAt,
      updatedAt: raw.updatedAt,
      lastNotified: raw.lastNotified,
      deletedAt: raw.deletedAt
    };
  }

  private toAlertResponse(raw: any): AlertResponse {
    if (raw?.alert) {
      return {
        alert: this.toAlert(raw.alert),
        message: raw.message
      };
    }

    return {
      alert: this.toAlert(raw),
      message: raw?.message
    };
  }

  /**
   * Obtiene todas las alertas.
   * Endpoint Postman: GET /api/alert
   */
  getAlerts(productId?: string): Observable<AlertListResponse> {
    return this.http.get<any>(`${this.getApiBaseUrl()}/alert`).pipe(
      map((response) => {
        const rawAlerts = Array.isArray(response)
          ? response
          : (response?.alerts ? response.alerts : (response ? [response] : []));

        const mapped: Alert[] = rawAlerts.map((raw: any) => this.toAlert(raw));
        const filtered = productId ? mapped.filter((a: Alert) => a.productId === productId) : mapped;

        return {
          alerts: filtered,
          total: filtered.length,
          page: 0,
          pageSize: filtered.length
        };
      })
    );
  }

  /**
   * Obtiene alertas de múltiples productos para estadísticas
   */
  getAlertsForProducts(productIds: string[]): Observable<Alert[]> {
    if (!productIds.length) {
      return of([]);
    }

    const requests = productIds.map((productId) =>
      this.getAlerts(productId).pipe(
        map((response) => response.alerts),
        catchError(() => of([]))
      )
    );

    return forkJoin(requests).pipe(
      map((result) => result.flat())
    );
  }

  /**
   * Obtiene una alerta específica
   * Endpoint Postman: GET /api/{alertId}/alert
   */
  getAlert(alertId: string): Observable<Alert> {
    return this.http.get<any>(this.buildAlertByIdUrl(alertId)).pipe(
      map((raw) => this.toAlert(raw))
    );
  }

  /**
   * Crea una nueva alerta.
   * Endpoint real del backend: POST /api/{productId}/alert  body: { frequency }
   * El userId lo obtiene el backend desde el JWT en SecurityContextHolder.
   */
  createAlert(productId: string, request: CreateAlertRequest): Observable<AlertResponse> {
    const url  = `${this.getApiBaseUrl()}/${encodeURIComponent(productId)}/alert`;
    const body = { frequency: request.frequency };   // enum lowercase: instant | daily | weekly

    return this.http.post<any>(url, body).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  findAlertByProductId(productId: string): Observable<Alert | null> {
    return this.getAlerts(productId).pipe(
      map((response) => {
        const found = response.alerts.find((alert) => alert.productId === productId) ?? null;
        return found;
      })
    );
  }

  createAlertWithoutDuplicate(productId: string, request: CreateAlertRequest): Observable<AlertResponse> {
    return this.findAlertByProductId(productId).pipe(
      catchError(() => of(null)),   // si getAlerts falla, continuar como si no existiera
      switchMap((existing) => {
        if (existing) {
          return of({ alert: existing, message: 'ALERT_ALREADY_EXISTS' });
        }
        return this.createAlert(productId, request);
      }),
      catchError((err) => {
        // 400 ALERT_EXISTS o 409 = ya existe — tratar como duplicado, no como error
        const isAlreadyExists =
          err?.status === 409 ||
          (err?.status === 400 && (
            err?.error?.code === 'ALERT_EXISTS' ||
            String(err?.error?.message ?? '').toLowerCase().includes('already exists')
          ));

        if (isAlreadyExists) {
          return this.findAlertByProductId(productId).pipe(
            catchError(() => of(null)),
            map((existing) => ({
              alert: existing ?? undefined,
              message: 'ALERT_ALREADY_EXISTS'
            }))
          );
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Actualiza una alerta (edita precio objetivo o frecuencia)
   * Endpoint Postman: PUT /api/{alertId}/alert
   */
  updateAlert(alertId: string, request: UpdateAlertRequest): Observable<AlertResponse> {
    const body = {
      frequency: request.frequency
    };

    return this.http.put<any>(this.buildAlertByIdUrl(alertId), body).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Cambia el estado de una alerta (activa/desactiva)
   * Endpoint Postman: PATCH /api/{alertId}/alert body: { isActive }
   */
  updateAlertStatus(alertId: string, request: UpdateAlertStatusRequest): Observable<AlertResponse> {
    const body = { isActive: request.isActive };

    return this.http.patch<any>(this.buildAlertByIdUrl(alertId), body).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Elimina una alerta
   * Endpoint Postman: DELETE /api/{alertId}/alert
   */
  deleteAlert(alertId: string): Observable<AlertResponse> {
    return this.http.delete<any>(this.buildAlertByIdUrl(alertId)).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Activates an alert
   */
  activateAlert(alertId: string): Observable<AlertResponse> {
    return this.updateAlertStatus(alertId, { isActive: true });
  }

  /**
   * Deactivates an alert
   */
  deactivateAlert(alertId: string): Observable<AlertResponse> {
    return this.updateAlertStatus(alertId, { isActive: false });
  }
}