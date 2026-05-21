package unicauca.edu.co.API.Services.Interfaces.IN;

import java.util.List;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;

public interface IWishlistService {

    WishlistItemDTO addProductToWishlist(String productId);

    List<NormalizedProductDTO> getNormalizedWishlistProducts(Integer limit, String sort);
}
