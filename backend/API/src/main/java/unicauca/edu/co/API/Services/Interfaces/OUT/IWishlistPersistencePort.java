package unicauca.edu.co.API.Services.Interfaces.OUT;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import unicauca.edu.co.API.Domain.Model.WishlistItem;

/**
 * Puerto de salida (outbound port) para la persistencia del m&oacute;dulo Wishlist.
 * Define las operaciones que el servicio de dominio necesita sobre el almacenamiento,
 * siguiendo el principio de inversi&oacute;n de dependencias de la Arquitectura Hexagonal.
 */
public interface IWishlistPersistencePort {

    /**
     * Persiste un nuevo wishlist item.
     *
     * @param wishlistItem modelo de dominio a guardar
     * @return el item persistido con sus valores generados (id, createdAt)
     */
    WishlistItem save(WishlistItem wishlistItem);

    /**
     * Busca un wishlist item por usuario y producto (para validar duplicados).
     *
     * @param userId    ID del usuario
     * @param productId ID del producto
     * @return Optional con el item si existe
     */
    Optional<WishlistItem> findByUserIdAndProductId(UUID userId, String productId);

    /**
     * Obtiene todos los wishlist items de un usuario con ordenamiento configurable.
     *
     * @param userId ID del usuario
     * @param sort   criterio de orden: {@code "recent"} (desc) o {@code "old"} (asc)
     * @return lista de wishlist items del usuario
     */
    List<WishlistItem> findByUserId(UUID userId, String sort);

    /**
     * Cuenta los productos en la wishlist de un usuario.
     * Utilizado para validar el l&iacute;mite de 5 productos para usuarios registered.
     *
     * @param userId ID del usuario
     * @return cantidad de productos en la wishlist
     */
    long countByUserId(UUID userId);
}
