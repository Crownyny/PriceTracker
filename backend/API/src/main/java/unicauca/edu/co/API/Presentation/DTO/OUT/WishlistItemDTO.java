package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO de salida para representar un item de la wishlist.
 * Se devuelve al cliente despu&eacute;s de crear un wishlist item.
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class WishlistItemDTO {
    /** Identificador &uacute;nico del wishlist item */
    private UUID id;
    /** ID del usuario propietario */
    private UUID userId;
    /** ID del producto agregado */
    private String productId;
    /** Fecha en que se agreg&oacute; */
    private LocalDateTime createdAt;
}
