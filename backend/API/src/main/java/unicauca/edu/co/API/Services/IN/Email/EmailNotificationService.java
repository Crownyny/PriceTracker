package unicauca.edu.co.API.Services.IN.Email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.RenderedEmailDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IEmailNotificationService;
import unicauca.edu.co.API.Services.Interfaces.IN.IEmailTemplateService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IEmailSenderService;

/**
 * Servicio de aplicacion para envio de correos de notificacion.
 *
 * Su responsabilidad es coordinar render de plantilla y despacho final.
 */
@Service
public class EmailNotificationService implements IEmailNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(EmailNotificationService.class);

    private final IEmailTemplateService emailTemplateService;
    private final IEmailSenderService emailSenderService;

    public EmailNotificationService(
        IEmailTemplateService emailTemplateService,
        IEmailSenderService emailSenderService
    ) {
        this.emailTemplateService = emailTemplateService;
        this.emailSenderService = emailSenderService;
    }

    /**
     * Ejecuta el flujo completo de envio de notificacion por correo.
     */
    @Override
    public void sendNotification(EmailNotificationRequestDTO request) {
        if (request == null || request.products() == null || request.products().isEmpty()) {
            logger.debug("Solicitud de correo ignorada por no tener productos para notificar");
            return;
        }

        RenderedEmailDTO renderedEmail = emailTemplateService.render(request);
        emailSenderService.sendHtml(
            request.recipientEmail(),
            renderedEmail.subject(),
            renderedEmail.htmlBody()
        );
    }
}
