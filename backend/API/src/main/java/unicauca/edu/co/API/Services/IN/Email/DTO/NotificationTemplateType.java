package unicauca.edu.co.API.Services.IN.Email.DTO;

/**
 * Tipos de plantilla soportados por el modulo de correos.
 */
public enum NotificationTemplateType {
    /** Notificacion inmediata por cambio reciente. */
    INSTANT,
    /** Resumen diario de cambios. */
    DAILY,
    /** Resumen semanal de cambios. */
    WEEKLY
}
