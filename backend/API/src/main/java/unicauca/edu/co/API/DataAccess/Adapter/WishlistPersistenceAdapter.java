package unicauca.edu.co.API.DataAccess.Adapter;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.DataAccess.Entity.WishlistItemEntity;
import unicauca.edu.co.API.DataAccess.Repository.WishlistItemRepository;
import unicauca.edu.co.API.Domain.Model.WishlistItem;
import unicauca.edu.co.API.Services.Interfaces.OUT.IWishlistPersistencePort;

@Component
public class WishlistPersistenceAdapter implements IWishlistPersistencePort {

    private final WishlistItemRepository wishlistItemRepository;

    public WishlistPersistenceAdapter(WishlistItemRepository wishlistItemRepository) {
        this.wishlistItemRepository = wishlistItemRepository;
    }

    @Override
    public WishlistItem save(WishlistItem wishlistItem) {
        WishlistItemEntity entity = toEntity(wishlistItem);
        return toDomain(wishlistItemRepository.save(entity));
    }

    @Override
    public Optional<WishlistItem> findByUserIdAndProductId(UUID userId, String productId) {
        return wishlistItemRepository.findByUserIdAndProductId(userId, productId)
                .map(this::toDomain);
    }

    @Override
    public List<WishlistItem> findByUserId(UUID userId, String sort) {
        List<WishlistItemEntity> entities;
        if ("old".equalsIgnoreCase(sort)) {
            entities = wishlistItemRepository.findByUserIdOrderByCreatedAtAsc(userId);
        } else {
            entities = wishlistItemRepository.findByUserIdOrderByCreatedAtDesc(userId);
        }
        return entities.stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    private WishlistItem toDomain(WishlistItemEntity entity) {
        return WishlistItem.builder()
                .id(entity.getId())
                .userId(entity.getUserId())
                .productId(entity.getProductId())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private WishlistItemEntity toEntity(WishlistItem domain) {
        WishlistItemEntity entity = new WishlistItemEntity();
        entity.setId(domain.getId());
        entity.setUserId(domain.getUserId());
        entity.setProductId(domain.getProductId());
        entity.setCreatedAt(domain.getCreatedAt());
        return entity;
    }
}
