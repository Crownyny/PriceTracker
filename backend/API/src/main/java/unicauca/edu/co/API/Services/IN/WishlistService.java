package unicauca.edu.co.API.Services.IN;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import unicauca.edu.co.API.Domain.Model.ErrorType;
import unicauca.edu.co.API.Domain.Model.WishlistItem;
import unicauca.edu.co.API.Exception.BusinessException;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;
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

    public WishlistService(
            IWishlistPersistencePort wishlistPersistencePort,
            IUserService userService,
            WishlistMapper wishlistMapper) {
        this.wishlistPersistencePort = wishlistPersistencePort;
        this.userService = userService;
        this.wishlistMapper = wishlistMapper;
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
    public List<WishlistItemDTO> getWishlist() {
        UUID userId = userService.getCurrentUserId();
        return wishlistPersistencePort.findAllByUserId(userId)
                .stream()
                .map(wishlistMapper::toDTO)
                .toList();
    }

    @Override
    public void removeProductFromWishlist(String productId) {
        UUID userId = userService.getCurrentUserId();

        wishlistPersistencePort.findByUserIdAndProductId(userId, productId)
                .orElseThrow(() -> new BusinessException(
                        "El producto no se encuentra en la lista de deseos",
                        ErrorType.WISHLIST_ITEM_NOT_FOUND));

        wishlistPersistencePort.deleteByUserIdAndProductId(userId, productId);
    }
}