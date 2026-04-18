package unicauca.edu.co.API.Services.IN.Email.Template;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.NotificationTemplateType;
import unicauca.edu.co.API.Services.IN.Email.DTO.RenderedEmailDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IEmailTemplateStrategy;

/**
 * Estrategia para plantillas de notificacion inmediata.
 */
@Component
public class InstantEmailTemplateStrategy implements IEmailTemplateStrategy {

    @Override
    public NotificationTemplateType supportedType() {
        return NotificationTemplateType.INSTANT;
    }

    @Override
    public RenderedEmailDTO render(EmailNotificationRequestDTO request) {
        return TemplateHtmlSupport.build(
            "Cambio inmediato de precio detectado",
            "Cambio de precio detectado",
            "Uno o mas productos cambiaron de precio y coinciden con tus alertas inmediatas.",
            request
        );
    }
}
