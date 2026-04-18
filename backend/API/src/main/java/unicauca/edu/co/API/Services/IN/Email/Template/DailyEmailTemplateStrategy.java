package unicauca.edu.co.API.Services.IN.Email.Template;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.NotificationTemplateType;
import unicauca.edu.co.API.Services.IN.Email.DTO.RenderedEmailDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IEmailTemplateStrategy;

/**
 * Estrategia para plantillas de resumen diario.
 */
@Component
public class DailyEmailTemplateStrategy implements IEmailTemplateStrategy {

    @Override
    public NotificationTemplateType supportedType() {
        return NotificationTemplateType.DAILY;
    }

    @Override
    public RenderedEmailDTO render(EmailNotificationRequestDTO request) {
        return TemplateHtmlSupport.build(
            "Resumen diario de cambios de precio",
            "Resumen diario de tus alertas",
            "Este resumen incluye productos con cambios de precio detectados durante las ultimas 24 horas.",
            request
        );
    }
}
