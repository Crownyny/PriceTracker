package unicauca.edu.co.API.Services.Interfaces.IN;

import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;

/**
 * Puerto de entrada para notificaciones por correo.
 *
 * Orquesta el flujo de negocio de notificacion: render de plantilla y envio.
 */
public interface IEmailNotificationService {

    /**
     * Envia una notificacion por correo a partir de un request ya enriquecido.
     *
     * @param request informacion del destinatario, tipo de plantilla y productos a reportar
     */
    void sendNotification(EmailNotificationRequestDTO request);
}
