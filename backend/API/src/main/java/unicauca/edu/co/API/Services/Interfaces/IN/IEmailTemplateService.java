package unicauca.edu.co.API.Services.Interfaces.IN;

import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.RenderedEmailDTO;

/**
 * Puerto de entrada para el motor de plantillas de correo.
 */
public interface IEmailTemplateService {

    /**
     * Genera asunto y cuerpo HTML para el request recibido.
     *
     * @param request request de notificacion
     * @return email renderizado listo para enviarse
     */
    RenderedEmailDTO render(EmailNotificationRequestDTO request);
}
