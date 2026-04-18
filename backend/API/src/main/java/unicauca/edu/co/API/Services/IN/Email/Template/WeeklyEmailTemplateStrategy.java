package unicauca.edu.co.API.Services.IN.Email.Template;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.NotificationTemplateType;
import unicauca.edu.co.API.Services.IN.Email.DTO.RenderedEmailDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IEmailTemplateStrategy;

/**
 * Estrategia para plantillas de resumen semanal.
 */
@Component
public class WeeklyEmailTemplateStrategy implements IEmailTemplateStrategy {

    @Override
    public NotificationTemplateType supportedType() {
        return NotificationTemplateType.WEEKLY;
    }

    @Override
    public RenderedEmailDTO render(EmailNotificationRequestDTO request) {
        return TemplateHtmlSupport.build(
            "Resumen semanal de cambios de precio",
            "Resumen semanal de tus alertas",
            "Aqui tienes los cambios detectados en la ultima semana para tus productos monitoreados.",
            request
        );
    }
}
