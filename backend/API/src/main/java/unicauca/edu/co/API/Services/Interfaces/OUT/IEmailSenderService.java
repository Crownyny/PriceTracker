package unicauca.edu.co.API.Services.Interfaces.OUT;

/**
 * Puerto de salida para el envio de correos.
 */
public interface IEmailSenderService {

    /**
     * Envia un correo HTML.
     *
     * @param to destinatario
     * @param subject asunto del correo
     * @param htmlBody cuerpo HTML
     */
    void sendHtml(String to, String subject, String htmlBody);
}
