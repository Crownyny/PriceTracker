package unicauca.edu.co.API.Domain.Model;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Modelo de dominio puro que representa un producto en la lista de deseos (wishlist).
 * No tiene dependencias de infraestructura ni anotaciones JPA.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WishlistItem {
    /** Identificador único del wishlist item */
    private UUID id;
    /** ID del usuario propietario */
    private UUID userId;
    /** ID del producto agregado (referencia a normalized_products) */
    private String productId;
    /** Fecha y hora en que se agregó a la wishlist */
    private LocalDateTime createdAt;
}
