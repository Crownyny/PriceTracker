package unicauca.edu.co.API.Services.Interfaces.OUT;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import unicauca.edu.co.API.Domain.Model.WishlistItem;

public interface IWishlistPersistencePort {

    WishlistItem save(WishlistItem wishlistItem);

    Optional<WishlistItem> findByUserIdAndProductId(UUID userId, String productId);

    List<WishlistItem> findAllByUserId(UUID userId);

    void deleteByUserIdAndProductId(UUID userId, String productId);
}