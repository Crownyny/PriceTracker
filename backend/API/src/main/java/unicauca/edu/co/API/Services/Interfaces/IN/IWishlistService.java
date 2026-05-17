package unicauca.edu.co.API.Services.Interfaces.IN;

import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;

public interface IWishlistService {

    WishlistItemDTO addProductToWishlist(String productId);
}
