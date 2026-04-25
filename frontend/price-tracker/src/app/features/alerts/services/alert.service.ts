import { Injectable } from '@angular/core';
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
    private httpConfig: HttpConfigService
  ) {}

  private normalizeFrequency(value?: string): AlertFrequency {
    const normalized = (value || '').toUpperCase();
    if (normalized === 'D1' || normalized === 'DAILY' || normalized === '1D') return 'D1';
    if (normalized === 'W1' || normalized === 'WEEKLY' || normalized === '1W') return 'W1';
    return 'ALL';
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
   * Obtiene las alertas de un producto
   */
  getAlerts(productId: string, frequency: AlertFrequency = 'ALL'): Observable<AlertListResponse> {
    let endpoint = `/products/${productId}/alert`;

    endpoint += `?frecuency=${frequency}`;

    return this.httpConfig.get<any>(endpoint).pipe(
      map((response) => {
        const rawAlerts = Array.isArray(response?.alerts) ? response.alerts : [];
        return {
          alerts: rawAlerts.map((raw: any) => this.toAlert(raw)),
          total: response?.total,
          page: response?.page,
          pageSize: response?.pageSize
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
      this.getAlerts(productId, 'ALL').pipe(
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
    return this.getAlerts(productId, 'ALL').pipe(
      map((response) => response.alerts.find((alert) => alert.id === alertId) as Alert)
    );
  }

  /**
   * Crea una nueva alerta
   */
  createAlert(productId: string, request: CreateAlertRequest): Observable<AlertResponse> {
    const body = {
      ...request,
      frecuency: request.frequency,
      frequency: request.frequency
    };

    return this.httpConfig.post<any>(`/products/${productId}/alert`, body).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Actualiza una alerta (edita precio objetivo o frecuencia)
   */
  updateAlert(productId: string, request: UpdateAlertRequest): Observable<AlertResponse> {
    const body = {
      ...request,
      frecuency: request.frequency
    };

    return this.httpConfig.put<any>(`/products/${productId}/alert`, body).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Cambia el estado de una alerta (activa/desactiva)
   */
  updateAlertStatus(productId: string, request: UpdateAlertStatusRequest): Observable<AlertResponse> {
    return this.httpConfig.patch<any>(`/products/${productId}/alert`, request).pipe(
      map((response) => this.toAlertResponse(response))
    );
  }

  /**
   * Elimina una alerta
   */
  deleteAlert(productId: string): Observable<AlertResponse> {
    return this.httpConfig.delete<any>(`/products/${productId}/alert`).pipe(
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
