package unicauca.edu.co.API.Services.IN.Email;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.NotificationTemplateType;
import unicauca.edu.co.API.Services.IN.Email.DTO.RenderedEmailDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IEmailTemplateService;
import unicauca.edu.co.API.Services.Interfaces.IN.IEmailTemplateStrategy;

/**
 * Servicio de seleccion de plantillas basado en el patron Strategy.
 */
@Service
public class EmailTemplateService implements IEmailTemplateService {

    private final Map<NotificationTemplateType, IEmailTemplateStrategy> strategies;

    public EmailTemplateService(List<IEmailTemplateStrategy> strategyList) {
        this.strategies = new EnumMap<>(NotificationTemplateType.class);
        for (IEmailTemplateStrategy strategy : strategyList) {
            this.strategies.put(strategy.supportedType(), strategy);
        }
    }

    /**
     * Delega el render al strategy correspondiente segun templateType.
     */
    @Override
    public RenderedEmailDTO render(EmailNotificationRequestDTO request) {
        IEmailTemplateStrategy strategy = strategies.get(request.templateType());
        if (strategy == null) {
            throw new IllegalArgumentException("No existe estrategia de template para: " + request.templateType());
        }
        return strategy.render(request);
    }
}
