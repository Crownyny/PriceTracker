import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { HttpConfigService } from '../../../core/services/http-config.service';
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
 * - GET /api/v1/products/{productId}/alert?frequency=1d
 * - POST /api/v1/products/{productId}/alert
 * - DELETE /api/v1/products/{productId}/alert
 * - PATCH /api/v1/products/{productId}/alert
 * - PUT /api/v1/products/{productId}/alert
 */
@Injectable({
  providedIn: 'root'
})
export class AlertService {
  constructor(
    private http: HttpClient,
    private httpConfig: HttpConfigService
  ) {}

  private getAlertsBaseUrl(): string {
    return `${this.httpConfig.getApiBaseUrl()}/alerts`;
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
    const url = productId ? `${this.getAlertsBaseUrl()}/${productId}` : this.getAlertsBaseUrl();

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
    const body = request.frequency;

    return this.http.post<any>(`${this.getAlertsBaseUrl()}/${productId}`, body).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Actualiza una alerta (edita precio objetivo o frecuencia)
   */
  updateAlert(productId: string, request: UpdateAlertRequest): Observable<AlertResponse> {
    return this.http.put<any>(`${this.getAlertsBaseUrl()}/${productId}`, request).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Cambia el estado de una alerta (activa/desactiva)
   */
  updateAlertStatus(productId: string, request: UpdateAlertStatusRequest): Observable<AlertResponse> {
    return this.http.patch<any>(`${this.getAlertsBaseUrl()}/${productId}/status?isActive=${request.isActive}`, {}).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Elimina una alerta
   */
  deleteAlert(productId: string): Observable<AlertResponse> {
    return this.http.delete<any>(`${this.getAlertsBaseUrl()}/${productId}`).pipe(
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
