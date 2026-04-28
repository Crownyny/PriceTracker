package unicauca.edu.co.API.Services.IN.Email.Template;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
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
  private static final Locale ES_CO_LOCALE = Locale.forLanguageTag("es-CO");
  private static final DecimalFormat COP_FORMAT = new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(ES_CO_LOCALE));
  private static final DecimalFormat GENERIC_FORMAT = new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.US));

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
        StringBuilder cards = new StringBuilder();

        for (ProductChangeEmailItemDTO item : request.products()) {
            String changeText = changeText(item);
            String changeStyle = directionTextStyle(item.changeDirection());
            String currentPriceStyle = directionPriceStyle(item.changeDirection());
            String productLink = safeUrl(item.sourceUrl());
            String sourceLine = hasText(item.sourceName()) ? "Fuente: " + escape(item.sourceName()) : "Fuente no disponible";
            String detectedAt = item.changeDetectedAt() != null ? item.changeDetectedAt().format(DATE_FORMATTER) : "N/A";

            cards.append("<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:#f8f9fc;border:1px solid #dde1ea;border-radius:14px;margin:0 0 16px 0;'>")
                .append("<tr>")
                .append("<td style='padding:18px;'>")
                .append("<table role='presentation' width='100%' cellpadding='0' cellspacing='0'>")
                .append("<tr>")
                .append("<td class='product-media' width='96' valign='top' style='width:96px;padding-right:16px;'>")
                .append("<div style='width:96px;height:96px;border-radius:14px;background:linear-gradient(135deg,#2f4fb2,#643a98);color:#ffffff;font-size:26px;line-height:96px;text-align:center;font-weight:700;'>PT</div>")
                .append("</td>")
                .append("<td valign='top' style='font-family:Segoe UI,Helvetica,Arial,sans-serif;'>")
                .append("<h3 class='product-title' style='margin:0 0 8px 0;color:#1f2635;font-size:36px;line-height:42px;font-weight:700;'>").append(escape(item.productName())).append("</h3>")
                .append("<p style='margin:0 0 8px 0;color:#6b7280;font-size:17px;text-decoration:line-through;'>").append(formatPrice(item.previousPrice(), item.currency())).append("</p>")
                .append("<p class='price-current' style='margin:0 0 8px 0;").append(currentPriceStyle).append("'>").append(formatPrice(item.currentPrice(), item.currency())).append("</p>")
                .append("<p style='margin:0 0 8px 0;").append(changeStyle).append("'>").append(changeText).append("</p>")
                .append("<p style='margin:0;color:#6b7280;font-size:12px;'>").append(sourceLine).append(" | Detectado: ").append(escape(detectedAt)).append("</p>")
                .append("</td>")
                .append("</tr>")
                .append("</table>")
                .append("<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin-top:14px;'>")
                .append("<tr>")
                .append("<td align='center' style='background:#2f49b5;border-radius:12px;'>")
                .append("<a href='").append(productLink).append("' style='display:block;padding:14px 18px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:18px;font-weight:600;color:#ffffff;text-decoration:none;'>Ver Producto en Dashboard</a>")
                .append("</td>")
                .append("</tr>")
                .append("</table>")
                .append("</td>")
                .append("</tr>")
                .append("</table>");
        }

        String html = """
            <html>
              <head>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                  @media only screen and (max-width: 640px) {
                    .email-container { width: 100%% !important; border-radius: 0 !important; }
                    .content-padding { padding: 18px !important; }
                    .product-media { width: 72px !important; padding-right: 10px !important; }
                    .product-media div { width: 72px !important; height: 72px !important; line-height: 72px !important; font-size: 20px !important; }
                    .product-title { font-size: 24px !important; line-height: 30px !important; }
                    .price-current { font-size: 34px !important; line-height: 40px !important; }
                  }
                </style>
              </head>
              <body style='font-family:Segoe UI,Helvetica,Arial,sans-serif;background:#eef0f4;margin:0;padding:18px;'>
                <table role='presentation' width='100%%' cellpadding='0' cellspacing='0' style='max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #cfd4df;border-radius:14px;overflow:hidden;' class='email-container'>
                  <tr>
                    <td style='background:linear-gradient(120deg,#273c91,#6a3f9e);color:#ffffff;padding:28px 30px;' class='content-padding'>
                      <h1 style='margin:0;font-size:34px;line-height:42px;font-weight:700;'>PriceTracker</h1>
                      <p style='margin:6px 0 0 0;font-size:18px;line-height:26px;color:#c9dcff;'>Alerta de Cambio de Precio</p>
                    </td>
                  </tr>
                  <tr>
                    <td style='padding:26px 30px 18px 30px;' class='content-padding'>
                      <p style='margin:0 0 18px 0;font-size:18px;line-height:30px;color:#2f3b50;'>%s</p>
                      <p style='margin:0 0 18px 0;font-size:16px;line-height:24px;color:#5b6476;'>%s</p>
                      <p style='margin:0 0 18px 0;font-size:15px;line-height:22px;color:#707889;'>%s</p>
                      %s
                      <p style='margin:18px 0 0 0;text-align:center;font-size:14px;line-height:22px;color:#6a7282;'>
                        Este enlace te llevara directamente a la grafica de precios del producto. Si tu sesion expiro, te pediremos que inicies sesion primero.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style='background:#f5f6f8;border-top:1px solid #dde1ea;padding:18px 22px;text-align:center;color:#5d6779;font-size:14px;line-height:22px;'>
                      Recibiste este correo porque tienes una alerta activa para este producto.<br>
                      &copy; 2026 PriceTracker - Todos los derechos reservados
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """;

        String greeting = "Hola! Tenemos novedades sobre un producto que estas siguiendo:";
        return new RenderedEmailDTO(subject, String.format(Locale.US, html, greeting, escape(title), escape(intro), cards));
    }

    private static String formatPrice(double price, String currency) {
        String safeCurrency = hasText(currency) ? currency.trim().toUpperCase(Locale.ROOT) : "COP";

        if ("COP".equals(safeCurrency)) {
            return "$" + COP_FORMAT.format(price);
        }

        return safeCurrency + " " + GENERIC_FORMAT.format(price);
    }

    private static String changeText(ProductChangeEmailItemDTO item) {
        double percent = percentage(item.previousPrice(), item.currentPrice());

        return switch (item.changeDirection()) {
          case UP -> "&uarr; El precio ha subido " + String.format(Locale.US, "%.2f%%", percent);
          case DOWN -> "&darr; El precio ha bajado " + String.format(Locale.US, "%.2f%%", percent);
            case SAME -> "Sin cambios de precio";
        };
    }

    private static String directionPriceStyle(PriceChangeDirection direction) {
        return switch (direction) {
          case UP -> "font-size:46px;line-height:52px;color:#df493c;font-weight:700;";
          case DOWN -> "font-size:46px;line-height:52px;color:#52bd56;font-weight:700;";
          case SAME -> "font-size:46px;line-height:52px;color:#334155;font-weight:700;";
        };
    }

    private static String directionTextStyle(PriceChangeDirection direction) {
        return switch (direction) {
            case UP -> "font-size:17px;line-height:24px;color:#df493c;font-weight:500;";
            case DOWN -> "font-size:17px;line-height:24px;color:#4fbf58;font-weight:500;";
            case SAME -> "font-size:17px;line-height:24px;color:#4b5563;font-weight:500;";
        };
    }

    private static double percentage(double previousPrice, double currentPrice) {
        if (previousPrice <= 0) {
            return 0d;
        }
        return Math.abs((currentPrice - previousPrice) * 100d / previousPrice);
    }

    private static String safeUrl(String url) {
        if (!hasText(url)) {
            return "#";
        }

        String value = url.trim();
        if (value.startsWith("http://") || value.startsWith("https://")) {
            return escape(value);
        }

        return "#";
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
