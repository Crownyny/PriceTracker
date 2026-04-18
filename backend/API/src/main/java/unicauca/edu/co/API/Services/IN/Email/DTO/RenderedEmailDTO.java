package unicauca.edu.co.API.Services.IN.Email.DTO;

/**
 * Resultado final del render de una plantilla de correo.
 *
 * @param subject asunto final
 * @param htmlBody cuerpo HTML final
 */
public record RenderedEmailDTO(
    String subject,
    String htmlBody
) {
}
