import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
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
 * Endpoints:
 * - GET /api/alerts
 * - GET /api/{userId}/alert?productId={productId}
 * - POST /api/{userId}/alert?productId={productId}
 * - PUT /api/{userId}/alert?productId={productId}
 * - PATCH /api/{userId}/alert?productId={productId}
 * - DELETE /api/{userId}/alert?productId={productId}
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
   * Obtiene alertas (si se envía productId, obtiene solo esa alerta)
   */
  getAlerts(productId?: string): Observable<AlertListResponse> {
    if (!productId) {
      // GET /api/alerts
      return this.http.get<any>(`${this.getApiBaseUrl()}/alerts`).pipe(
        map((response) => {
          const rawAlerts = Array.isArray(response)
            ? response
            : (response?.alerts ? response.alerts : (response ? [response] : []));

          return {
            alerts: rawAlerts.map((raw: any) => this.toAlert(raw)),
            total: rawAlerts.length,
            page: 0,
            pageSize: rawAlerts.length
          };
        })
      );
    }

    // GET /api/{userId}/alert?productId={productId}
    const userId = this.getCurrentUserId();
    const url = `${this.buildUserAlertUrl(userId)}?productId=${encodeURIComponent(productId)}`;

    return this.http.get<any>(url).pipe(
      map((response) => {
        const rawAlerts = Array.isArray(response)
          ? response
          : (response?.alerts ? response.alerts : (response ? [response] : []));

        return {
          alerts: rawAlerts.map((raw: any) => this.toAlert(raw)),
          total: rawAlerts.length,
          page: 0,
          pageSize: rawAlerts.length
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
   */
  getAlert(productId: string, alertId: string): Observable<Alert> {
    return this.getAlerts(productId).pipe(
      map((response) => response.alerts.find((alert) => alert.id === alertId) as Alert)
    );
  }

  /**
   * Crea una nueva alerta
   */
  createAlert(productId: string, request: CreateAlertRequest): Observable<AlertResponse> {
    const userId = this.getCurrentUserId();
    const url = `${this.buildUserAlertUrl(userId)}?productId=${encodeURIComponent(productId)}`;
    const body = {
      frequency: request.frequency
    };

    return this.http.post<any>(url, body).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Actualiza una alerta (edita precio objetivo o frecuencia)
   */
  updateAlert(productId: string, request: UpdateAlertRequest): Observable<AlertResponse> {
    const userId = this.getCurrentUserId();
    const url = `${this.buildUserAlertUrl(userId)}?productId=${encodeURIComponent(productId)}`;

    return this.http.put<any>(url, request).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Cambia el estado de una alerta (activa/desactiva)
   */
  updateAlertStatus(productId: string, request: UpdateAlertStatusRequest): Observable<AlertResponse> {
    const userId = this.getCurrentUserId();
    const url = `${this.buildUserAlertUrl(userId)}?productId=${encodeURIComponent(productId)}`;
    const body = { isActive: request.isActive };

    return this.http.patch<any>(url, body).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Elimina una alerta
   */
  deleteAlert(productId: string): Observable<AlertResponse> {
    const userId = this.getCurrentUserId();
    const url = `${this.buildUserAlertUrl(userId)}?productId=${encodeURIComponent(productId)}`;

    return this.http.delete<any>(url).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Activates an alert
   */
  activateAlert(productId: string): Observable<AlertResponse> {
    return this.updateAlertStatus(productId, { isActive: true });
  }

  /**
   * Deactivates an alert
   */
  deactivateAlert(productId: string): Observable<AlertResponse> {
    return this.updateAlertStatus(productId, { isActive: false });
  }
}
