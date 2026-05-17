package unicauca.edu.co.API.DataAccess.Repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.WishlistItemEntity;

@Repository
public interface WishlistItemRepository extends JpaRepository<WishlistItemEntity, UUID> {
    Optional<WishlistItemEntity> findByUserIdAndProductId(UUID userId, String productId);
}
