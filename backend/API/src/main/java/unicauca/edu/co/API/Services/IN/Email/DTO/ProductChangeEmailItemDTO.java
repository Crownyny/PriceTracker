package unicauca.edu.co.API.Services.IN.Email.DTO;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Item de producto incluido en el correo de notificacion.
 *
 * @param alertId alerta que produjo la notificacion
 * @param productId id del producto monitoreado
 * @param productName nombre canonico del producto
 * @param sourceName tienda o fuente
 * @param sourceUrl URL fuente del producto
 * @param currency moneda del precio
 * @param previousPrice precio base para comparar
 * @param currentPrice precio actual
 * @param changeDirection direccion del cambio de precio
 * @param changeDetectedAt fecha/hora del ultimo cambio evaluado
 */
public record ProductChangeEmailItemDTO(
    UUID alertId,
    String productId,
    String productName,
    String sourceName,
    String sourceUrl,
    String currency,
    double previousPrice,
    double currentPrice,
    PriceChangeDirection changeDirection,
    LocalDateTime changeDetectedAt
) {
}
