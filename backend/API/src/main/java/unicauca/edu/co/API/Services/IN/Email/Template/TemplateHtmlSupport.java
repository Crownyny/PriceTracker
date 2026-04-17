package unicauca.edu.co.API.Services.IN.Email.Template;

import java.time.format.DateTimeFormatter;
import java.util.Locale;

import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.PriceChangeDirection;
import unicauca.edu.co.API.Services.IN.Email.DTO.ProductChangeEmailItemDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.RenderedEmailDTO;

/**
 * Utilidad interna para construir HTML de notificaciones.
 *
 * Centraliza formato de precios, etiquetas de cambio y escape basico de contenido.
 */
final class TemplateHtmlSupport {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private TemplateHtmlSupport() {
    }

    /**
     * Construye el cuerpo HTML tabular reutilizado por las plantillas.
     *
     * @param fallbackSubject asunto por defecto cuando el request no define uno
     * @param title titulo visual del correo
     * @param intro descripcion corta del contexto del correo
     * @param request informacion de productos a renderizar
     * @return asunto y html final
     */
    static RenderedEmailDTO build(
        String fallbackSubject,
        String title,
        String intro,
        EmailNotificationRequestDTO request
    ) {
        String subject = hasText(request.subject()) ? request.subject().trim() : fallbackSubject;
        StringBuilder rows = new StringBuilder();

        for (ProductChangeEmailItemDTO item : request.products()) {
            String statusLabel = directionLabel(item.changeDirection());
            String statusStyle = directionStyle(item.changeDirection());
            rows.append("<tr>")
                .append("<td style='padding:10px;border-bottom:1px solid #e6e6e6;'>").append(escape(item.productName())).append("</td>")
                .append("<td style='padding:10px;border-bottom:1px solid #e6e6e6;'>").append(escape(item.sourceName())).append("</td>")
                .append("<td style='padding:10px;border-bottom:1px solid #e6e6e6;'>").append(formatPrice(item.previousPrice(), item.currency())).append("</td>")
                .append("<td style='padding:10px;border-bottom:1px solid #e6e6e6;'>").append(formatPrice(item.currentPrice(), item.currency())).append("</td>")
                .append("<td style='padding:10px;border-bottom:1px solid #e6e6e6;'><span style='").append(statusStyle).append("'>")
                .append(statusLabel)
                .append("</span></td>")
                .append("<td style='padding:10px;border-bottom:1px solid #e6e6e6;'>")
                .append(item.changeDetectedAt() != null ? item.changeDetectedAt().format(DATE_FORMATTER) : "N/A")
                .append("</td>")
                .append("</tr>");
        }

        String html = """
            <html>
              <body style='font-family:Verdana,sans-serif;background:#f5f7fa;margin:0;padding:24px;'>
                <table width='100%%' cellpadding='0' cellspacing='0' style='max-width:900px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;'>
                  <tr>
                    <td style='background:linear-gradient(120deg,#0f766e,#2563eb);color:#ffffff;padding:24px 28px;'>
                      <h2 style='margin:0 0 8px 0;'>%s</h2>
                      <p style='margin:0;opacity:.95;'>%s</p>
                    </td>
                  </tr>
                  <tr>
                    <td style='padding:20px 28px 10px 28px;'>
                      <table width='100%%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;'>
                        <thead>
                          <tr style='background:#f2f4f7;text-align:left;'>
                            <th style='padding:10px;'>Producto</th>
                            <th style='padding:10px;'>Tienda</th>
                            <th style='padding:10px;'>Precio anterior</th>
                            <th style='padding:10px;'>Precio actual</th>
                            <th style='padding:10px;'>Estado</th>
                            <th style='padding:10px;'>Detectado en</th>
                          </tr>
                        </thead>
                        <tbody>
                          %s
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """;

        return new RenderedEmailDTO(subject, String.format(Locale.US, html, escape(title), escape(intro), rows));
    }

    private static String formatPrice(double price, String currency) {
        String safeCurrency = hasText(currency) ? currency.trim() : "COP";
        return safeCurrency + " " + String.format(Locale.US, "%.2f", price);
    }

    private static String directionLabel(PriceChangeDirection direction) {
        return switch (direction) {
            case UP -> "Subio";
            case DOWN -> "Bajo";
            case SAME -> "Sin cambios";
        };
    }

    private static String directionStyle(PriceChangeDirection direction) {
        return switch (direction) {
            case UP -> "padding:4px 8px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-weight:600;";
            case DOWN -> "padding:4px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:600;";
            case SAME -> "padding:4px 8px;border-radius:999px;background:#e2e8f0;color:#1e293b;font-weight:600;";
        };
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }

        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
