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

/**
 * Adaptador de persistencia para el modulo Wishlist.
 * Implementa el puerto de salida {@link IWishlistPersistencePort}
 * delegando en {@link WishlistItemRepository} (Spring Data JPA).
 * <p>
 * Sigue el patrón de Arquitectura Hexagonal: este adaptador pertenece
 * a la capa de infraestructura y es inyectado en el servicio de dominio.
 */
@Component
public class WishlistPersistenceAdapter implements IWishlistPersistencePort {

    private final WishlistItemRepository wishlistItemRepository;

    public WishlistPersistenceAdapter(WishlistItemRepository wishlistItemRepository) {
        this.wishlistItemRepository = wishlistItemRepository;
    }

    /**
     * {@inheritDoc}
     * Convierte el modelo de dominio a entidad JPA, persiste y devuelve el dominio.
     */
    @Override
    public WishlistItem save(WishlistItem wishlistItem) {
        WishlistItemEntity entity = toEntity(wishlistItem);
        return toDomain(wishlistItemRepository.save(entity));
    }

    /**
     * {@inheritDoc}
     * Busca en la base de datos por userId + productId y mapea a dominio si existe.
     */
    @Override
    public Optional<WishlistItem> findByUserIdAndProductId(UUID userId, String productId) {
        return wishlistItemRepository.findByUserIdAndProductId(userId, productId)
                .map(this::toDomain);
    }

    /**
     * {@inheritDoc}
     * Delega el conteo al repositorio JPA.
     */
    @Override
    public long countByUserId(UUID userId) {
        return wishlistItemRepository.countByUserId(userId);
    }

    /**
     * {@inheritDoc}
     * Delega la consulta al repositorio aplicando el orden seg&uacute;n el par&aacute;metro {@code sort}.
     */
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

    /**
     * Convierte una entidad JPA a modelo de dominio puro.
     *
     * @param entity entidad JPA
     * @return modelo de dominio WishlistItem
     */
    private WishlistItem toDomain(WishlistItemEntity entity) {
        return WishlistItem.builder()
                .id(entity.getId())
                .userId(entity.getUserId())
                .productId(entity.getProductId())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    /**
     * Convierte un modelo de dominio a entidad JPA.
     *
     * @param domain modelo de dominio
     * @return entidad JPA WishlistItemEntity
     */
    private WishlistItemEntity toEntity(WishlistItem domain) {
        WishlistItemEntity entity = new WishlistItemEntity();
        entity.setId(domain.getId());
        entity.setUserId(domain.getUserId());
        entity.setProductId(domain.getProductId());
        entity.setCreatedAt(domain.getCreatedAt());
        return entity;
    }
}
