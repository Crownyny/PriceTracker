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
import unicauca.edu.co.API.Domain.Model.WishlistItem;
import unicauca.edu.co.API.Exception.BusinessException;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;
import unicauca.edu.co.API.Presentation.Mapper.NormalizedProductMapper;
import unicauca.edu.co.API.Presentation.Mapper.WishlistMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;
import unicauca.edu.co.API.Services.Interfaces.IN.IWishlistService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IWishlistPersistencePort;

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

    @Override
    public WishlistItemDTO addProductToWishlist(String productId) {
        UUID userId = userService.getCurrentUserId();

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

    private NormalizedProductDTO buildProductDTO(NormalizedProductEntity entity) {
        NormalizedProductDTO dto = normalizedProductMapper.toDTO(entity);
        dto.setScrapedAt(entity.getLastScrapedAt() != null
                ? entity.getLastScrapedAt().toString()
                : null);
        dto.setConfidence(calculateConfidence(entity));
        return dto;
    }

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
