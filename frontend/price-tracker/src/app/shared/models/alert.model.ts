/**
 * Alert Model - Alertas de precio para productos
 */
export interface Alert {
  id: string;
  productId: string;
  productRef: string;
  userId: string;
  targetPrice: number;
  currency: string;
  frequency: AlertFrequency;
  isActive: boolean;
  notificationMethod: NotificationMethod;
  createdAt: Date;
  updatedAt: Date;
  lastNotified?: Date;
}

/**
 * Frecuencia de alertas
 */
export type AlertFrequency = '1h' | '6h' | '1d' | '1w' | '1m';

/**
 * Método de notificación
 */
export type NotificationMethod = 'email' | 'push' | 'both';

/**
 * DTO para crear una alerta
 */
export interface CreateAlertRequest {
  productId: string;
  targetPrice: number;
  currency: string;
  frequency: AlertFrequency;
  notificationMethod: NotificationMethod;
}

/**
 * DTO para actualizar una alerta
 */
export interface UpdateAlertRequest {
  targetPrice?: number;
  frequency?: AlertFrequency;
  notificationMethod?: NotificationMethod;
}

/**
 * DTO para cambiar estado de alerta
 */
export interface UpdateAlertStatusRequest {
  isActive: boolean;
}

/**
 * Respuesta de alerta
 */
export interface AlertResponse {
  alert: Alert;
  message: string;
}

/**
 * Respuesta de lista de alertas
 */
export interface AlertListResponse {
  alerts: Alert[];
  total: number;
  page: number;
  pageSize: number;
}
