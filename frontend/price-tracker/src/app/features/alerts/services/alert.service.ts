import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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

  /**
   * Obtiene las alertas de un producto
   */
  getAlerts(productId: string, frequency?: AlertFrequency): Observable<AlertListResponse> {
    let endpoint = `/products/${productId}/alert`;
    
    if (frequency) {
      endpoint += `?frequency=${frequency}`;
    }

    return this.httpConfig.get<AlertListResponse>(endpoint);
  }

  /**
   * Obtiene una alerta específica
   */
  getAlert(productId: string, alertId: string): Observable<Alert> {
    return this.httpConfig.get<Alert>(`/products/${productId}/alert/${alertId}`);
  }

  /**
   * Crea una nueva alerta
   */
  createAlert(productId: string, request: CreateAlertRequest): Observable<AlertResponse> {
    return this.httpConfig.post<AlertResponse>(`/products/${productId}/alert`, request);
  }

  /**
   * Actualiza una alerta (edita precio objetivo o frecuencia)
   */
  updateAlert(productId: string, alertId: string, request: UpdateAlertRequest): Observable<AlertResponse> {
    return this.httpConfig.put<AlertResponse>(`/products/${productId}/alert/${alertId}`, request);
  }

  /**
   * Cambia el estado de una alerta (activa/desactiva)
   */
  updateAlertStatus(productId: string, alertId: string, request: UpdateAlertStatusRequest): Observable<AlertResponse> {
    return this.httpConfig.patch<AlertResponse>(`/products/${productId}/alert/${alertId}`, request);
  }

  /**
   * Elimina una alerta
   */
  deleteAlert(productId: string, alertId: string): Observable<void> {
    return this.httpConfig.delete<void>(`/products/${productId}/alert/${alertId}`);
  }

  /**
   * Activates an alert
   */
  activateAlert(productId: string, alertId: string): Observable<AlertResponse> {
    return this.updateAlertStatus(productId, alertId, { isActive: true });
  }

  /**
   * Deactivates an alert
   */
  deactivateAlert(productId: string, alertId: string): Observable<AlertResponse> {
    return this.updateAlertStatus(productId, alertId, { isActive: false });
  }
}
