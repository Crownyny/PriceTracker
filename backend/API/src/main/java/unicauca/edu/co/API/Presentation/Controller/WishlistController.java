package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IWishlistService;

@RestController
@RequestMapping("/api/v1/wishlist")
public class WishlistController {

    private final IWishlistService wishlistService;

    public WishlistController(IWishlistService wishlistService) {
        this.wishlistService = wishlistService;
    }

    @PostMapping("/product/{idProduct}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<WishlistItemDTO> addProductToWishlist(@PathVariable String idProduct) {
        WishlistItemDTO wishlistItem = wishlistService.addProductToWishlist(idProduct);
        return ResponseEntity.status(HttpStatus.CREATED).body(wishlistItem);
    }
}
