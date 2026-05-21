package unicauca.edu.co.API.DataAccess.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.WishlistItemEntity;

/**
 * Repositorio JPA para la entidad {@link WishlistItemEntity}.
 * Proporciona m&eacute;todos de acceso a datos para la tabla {@code wishlist_item}.
 */
@Repository
public interface WishlistItemRepository extends JpaRepository<WishlistItemEntity, UUID> {

    /**
     * Busca un wishlist item por usuario y producto.
     *
     * @param userId    ID del usuario
     * @param productId ID del producto
     * @return Optional con el item si existe
     */
    Optional<WishlistItemEntity> findByUserIdAndProductId(UUID userId, String productId);

    /**
     * Obtiene todos los wishlist items de un usuario ordenados por fecha de creaci&oacute;n descendente
     * (m&aacute;s recientes primero).
     *
     * @param userId ID del usuario
     * @return lista de items ordenados por created_at DESC
     */
    List<WishlistItemEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * Obtiene todos los wishlist items de un usuario ordenados por fecha de creaci&oacute;n ascendente
     * (m&aacute;s antiguos primero).
     *
     * @param userId ID del usuario
     * @return lista de items ordenados por created_at ASC
     */
    List<WishlistItemEntity> findByUserIdOrderByCreatedAtAsc(UUID userId);

    /**
     * Cuenta cu&aacute;ntos productos tiene un usuario en su lista de deseos.
     *
     * @param userId ID del usuario
     * @return n&uacute;mero de wishlist items del usuario
     */
    long countByUserId(UUID userId);
}
