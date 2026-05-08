package unicauca.edu.co.API.Services.OUT;

import jakarta.mail.internet.MimeMessage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;

import unicauca.edu.co.API.Services.Interfaces.OUT.IEmailSenderService;

/**
 * Adaptador SMTP para envio de correos HTML usando Spring Mail.
 */
@Service
public class EmailSenderService implements IEmailSenderService {

    private static final Logger logger = LoggerFactory.getLogger(EmailSenderService.class);

    private final JavaMailSender mailSender;

    @Value("${mail.sender.address:no-reply@pricetracker.local}")
    private String senderAddress;

    public EmailSenderService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * Construye un mensaje MIME y lo envia al servidor SMTP configurado.
     * Reintenta hasta 3 veces con delay exponencial en caso de fallos.
     */
    @Override
    @Retryable(
        retryFor = Exception.class,
        maxAttempts = 3,
        backoff = @Backoff(delay = 5000, multiplier = 2.0)
    )
    public void sendHtml(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(senderAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
            logger.info("Correo enviado correctamente a {}", to);
        } catch (Exception ex) {
            logger.error("No fue posible enviar correo a {}", to, ex);
            throw new IllegalStateException("No fue posible enviar el correo", ex);
        }
    }
}
