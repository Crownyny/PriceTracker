package unicauca.edu.co.API.DataAccess.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.WishlistItemEntity;

@Repository
public interface WishlistItemRepository extends JpaRepository<WishlistItemEntity, UUID> {
    Optional<WishlistItemEntity> findByUserIdAndProductId(UUID userId, String productId);

    List<WishlistItemEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<WishlistItemEntity> findByUserIdOrderByCreatedAtAsc(UUID userId);

    /**
     * Cuenta cuántos productos tiene un usuario en su lista de deseos.
     * @param userId ID del usuario
     * @return número de wishlist items del usuario
     */
    long countByUserId(UUID userId);
}
