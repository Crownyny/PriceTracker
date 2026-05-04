/**
 * Alert Model - Alertas de precio para productos
 */
export interface Alert {
  id: string;
  productId: string;
  productRef?: string;
  userId: string;
  targetPrice: number;
  currency?: string;
  condition?: string;
  frequency: AlertFrequency;
  isActive: boolean;
  notificationMethod?: NotificationMethod;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  lastNotified?: Date | string;
  deletedAt?: Date | string;
}

/**
 * Frecuencia de alertas
 */
export type AlertFrequency = 'instant' | 'daily' | 'weekly';

/**
 * Método de notificación
 */
export type NotificationMethod = 'email' | 'push' | 'both';

/**
 * DTO para crear una alerta
 */
export interface CreateAlertRequest {
  productId?: string;
  targetPrice?: number;
  currency?: string;
  condition?: string;
  frecuency?: AlertFrequency;
  frequency: AlertFrequency;
  notificationMethod?: NotificationMethod;
}

/**
 * DTO para actualizar una alerta
 */
export interface UpdateAlertRequest {
  targetPrice?: number;
  condition?: string;
  frecuency?: AlertFrequency;
  frequency?: AlertFrequency;
  notificationMethod?: NotificationMethod;
}

/**
 * DTO para cambiar estado de alerta
 */
export interface UpdateAlertStatusRequest {
  isActive: boolean;
}

export interface AlertRequest {
  frequency?: AlertFrequency;
  isActive?: boolean;
}

/**
 * Respuesta de alerta
 */
export interface AlertResponse {
  alert?: Alert;
  message?: string;
}

/**
 * Respuesta de lista de alertas
 */
export interface AlertListResponse {
  alerts: Alert[];
  total?: number;
  page?: number;
  pageSize?: number;
}
