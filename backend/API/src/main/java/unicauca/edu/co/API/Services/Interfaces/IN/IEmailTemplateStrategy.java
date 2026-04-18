package unicauca.edu.co.API.Services.Interfaces.IN;

import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.NotificationTemplateType;
import unicauca.edu.co.API.Services.IN.Email.DTO.RenderedEmailDTO;

/**
 * Estrategia de render de plantilla por tipo de notificacion.
 */
public interface IEmailTemplateStrategy {

    /**
     * @return tipo de plantilla soportado por la estrategia
     */
    NotificationTemplateType supportedType();

    /**
     * Renderiza el correo usando la estrategia concreta.
     *
     * @param request request de notificacion
     * @return asunto y cuerpo HTML finales
     */
    RenderedEmailDTO render(EmailNotificationRequestDTO request);
}
