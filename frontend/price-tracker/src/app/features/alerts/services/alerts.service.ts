import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AlertService } from './alert.service';
import {
  Alert,
  AlertListResponse,
  AlertResponse,
  CreateAlertRequest,
  UpdateAlertRequest,
  UpdateAlertStatusRequest
} from '../../../shared/models/alert.model';

/**
 * AlertsService (wrapper)
 *
 * Requerido por la entrega: `alerts.service.ts`.
 * Mantiene compatibilidad con el `AlertService` existente.
 */
export type AlertFrequency = 'immediate' | 'daily' | 'weekly';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  constructor(private readonly inner: AlertService) {}

  getAlerts(productId?: string): Observable<AlertListResponse> {
    return this.inner.getAlerts(productId);
  }

  getAlert(alertId: string): Observable<Alert> {
    return this.inner.getAlert(alertId);
  }

  createAlert(productId: string, request: CreateAlertRequest): Observable<AlertResponse> {
    return this.inner.createAlert(productId, request);
  }

  updateAlert(alertId: string, request: UpdateAlertRequest): Observable<AlertResponse> {
    return this.inner.updateAlert(alertId, request);
  }

  updateAlertStatus(alertId: string, request: UpdateAlertStatusRequest): Observable<AlertResponse> {
    return this.inner.updateAlertStatus(alertId, request);
  }

  deleteAlert(alertId: string): Observable<AlertResponse> {
    return this.inner.deleteAlert(alertId);
  }
}

