package unicauca.edu.co.API.Services.IN.Email.DTO;

import java.util.List;
import java.util.UUID;

/**
 * Request de negocio para disparar un correo de notificacion.
 *
 * @param userId id del usuario propietario de la alerta
 * @param recipientEmail correo destino
 * @param templateType tipo de plantilla a renderizar
 * @param subject asunto personalizado (opcional segun estrategia)
 * @param products productos incluidos en el correo
 */
public record EmailNotificationRequestDTO(
    UUID userId,
    String recipientEmail,
    NotificationTemplateType templateType,
    String subject,
    List<ProductChangeEmailItemDTO> products
) {
}
