package unicauca.edu.co.API.Services.IN;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.Domain.Model.ErrorType;
import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Domain.Model.UserRole;
import unicauca.edu.co.API.Domain.Model.WishlistItem;
import unicauca.edu.co.API.Exception.BusinessException;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;
import unicauca.edu.co.API.Presentation.Mapper.NormalizedProductMapper;
import unicauca.edu.co.API.Presentation.Mapper.WishlistMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;
import unicauca.edu.co.API.Services.Interfaces.IN.IWishlistService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IWishlistPersistencePort;

/**
 * Servicio de dominio para el m&oacute;dulo Wishlist.
 * Implementa los casos de uso definidos en {@link IWishlistService}.
 * <p>
 * Dependencias:
 * <ul>
 *   <li>{@link IWishlistPersistencePort} — puerto de salida para persistencia</li>
 *   <li>{@link IUserService} — para obtener el usuario autenticado y su rol</li>
 * </ul>
 * <p>
 * Reglas de negocio:
 * <ul>
 *   <li>Usuarios <b>registered</b> pueden tener hasta 5 productos en su wishlist</li>
 *   <li>Usuarios <b>premium</b> no tienen l&iacute;mite</li>
 *   <li>No se permite duplicar un producto en la misma wishlist</li>
 * </ul>
 */
@Service
@Transactional
public class WishlistService implements IWishlistService {

    private final IWishlistPersistencePort wishlistPersistencePort;
    private final IUserService userService;
    private final WishlistMapper wishlistMapper;
    private final ProductRepository productRepository;
    private final NormalizedProductMapper normalizedProductMapper;

    public WishlistService(
            IWishlistPersistencePort wishlistPersistencePort,
            IUserService userService,
            WishlistMapper wishlistMapper,
            ProductRepository productRepository,
            NormalizedProductMapper normalizedProductMapper) {
        this.wishlistPersistencePort = wishlistPersistencePort;
        this.userService = userService;
        this.wishlistMapper = wishlistMapper;
        this.productRepository = productRepository;
        this.normalizedProductMapper = normalizedProductMapper;
    }

    /**
     * Agrega un producto a la wishlist del usuario autenticado.
     * <p>
     * Validaciones:
     * <ul>
     *   <li>Si el usuario es <b>registered</b> y ya tiene 5 productos, lanza {@link ErrorType#WISHLIST_LIMIT_REACHED}</li>
     *   <li>Si el producto ya existe en la wishlist, lanza {@link ErrorType#PRODUCT_ALREADY_IN_WISHLIST}</li>
     *   <li>Los usuarios <b>premium</b> no tienen límite de productos</li>
     * </ul>
     *
     * @param productId ID del producto a agregar
     * @return WishlistItemDTO del item creado
     * @throws BusinessException si se viola alguna regla de negocio
     */
    @Override
    public WishlistItemDTO addProductToWishlist(String productId) {
        UUID userId = userService.getCurrentUserId();

        User user = userService.findById(userId);
        if (user.getRole() == UserRole.registered) {
            long currentCount = wishlistPersistencePort.countByUserId(userId);
            if (currentCount >= 5) {
                throw new BusinessException(
                        "Has alcanzado el límite de 5 productos en tu lista de deseos. Actualiza a premium para agregar más.",
                        ErrorType.WISHLIST_LIMIT_REACHED);
            }
        }

        var existingItem = wishlistPersistencePort.findByUserIdAndProductId(userId, productId);
        if (existingItem.isPresent()) {
            throw new BusinessException(
                    "El producto ya se encuentra en la lista de deseos",
                    ErrorType.PRODUCT_ALREADY_IN_WISHLIST);
        }

        WishlistItem wishlistItem = WishlistItem.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .productId(productId)
                .createdAt(LocalDateTime.now())
                .build();

        WishlistItem savedItem = wishlistPersistencePort.save(wishlistItem);
        return wishlistMapper.toDTO(savedItem);
    }

    /**
     * {@inheritDoc}
     * <p>
     * Obtiene los wishlist items del usuario, los empareja con sus productos normalizados
     * (saltando aquellos cuyo producto no exista en la BD), aplica el filtro de cantidad
     * y devuelve los DTOs enriquecidos con confianza y fecha de scrap.
     */
    @Override
    @Transactional(readOnly = true)
    public List<NormalizedProductDTO> getNormalizedWishlistProducts(Integer limit, String sort) {
        UUID userId = userService.getCurrentUserId();
        String sortDir = (sort != null) ? sort : "recent";

        List<WishlistItem> wishlistItems = wishlistPersistencePort.findByUserId(userId, sortDir);

        List<String> productIds = wishlistItems.stream()
                .map(WishlistItem::getProductId)
                .collect(Collectors.toList());

        if (productIds.isEmpty()) {
            return List.of();
        }

        Map<String, NormalizedProductEntity> products = productRepository.findAllById(productIds)
                .stream()
                .collect(Collectors.toMap(NormalizedProductEntity::getId, p -> p));

        List<NormalizedProductDTO> resultList = wishlistItems.stream()
                .map(item -> {
                    NormalizedProductEntity entity = products.get(item.getProductId());
                    if (entity == null) return null;
                    return buildProductDTO(entity);
                })
                .filter(dto -> dto != null)
                .collect(Collectors.toList());

        if (limit != null && limit > 0 && limit < resultList.size()) {
            resultList = resultList.subList(0, limit);
        }

        return resultList;
    }

    /**
     * Construye un {@link NormalizedProductDTO} enriquecido con metadatos adicionales:
     * fecha del &uacute;ltimo scrapeo y nivel de confianza.
     *
     * @param entity entidad del producto normalizado
     * @return DTO enriquecido
     */
    private NormalizedProductDTO buildProductDTO(NormalizedProductEntity entity) {
        NormalizedProductDTO dto = normalizedProductMapper.toDTO(entity);
        dto.setScrapedAt(entity.getLastScrapedAt() != null
                ? entity.getLastScrapedAt().toString()
                : null);
        dto.setConfidence(calculateConfidence(entity));
        return dto;
    }

    /**
     * Calcula el nivel de confianza del precio en base a cu&aacute;ntos d&iacute;as
     * pasaron desde el &uacute;ltimo scrapeo.
     * <ul>
     *   <li>&le; 1 d&iacute;a → {@code HIGH}</li>
     *   <li>&le; 7 d&iacute;as → {@code MEDIUM}</li>
     *   <li>&gt; 7 d&iacute;as o null → {@code LOW}</li>
     * </ul>
     *
     * @param entity entidad del producto normalizado
     * @return nivel de confianza como String
     */
    private String calculateConfidence(NormalizedProductEntity entity) {
        if (entity.getLastScrapedAt() == null) {
            return "LOW";
        }
        long daysSinceScraped = Duration.between(entity.getLastScrapedAt(), LocalDateTime.now()).toDays();
        if (daysSinceScraped <= 1) {
            return "HIGH";
        } else if (daysSinceScraped <= 7) {
            return "MEDIUM";
        }
        return "LOW";
    }
}
