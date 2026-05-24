package unicauca.edu.co.API.Presentation.Controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistProductDetailDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IWishlistService;

/**
 * Controlador REST del m&oacute;dulo Wishlist.
 * Expone los endpoints para gestionar la lista de deseos del usuario autenticado.
 * <p>
 * Todos los endpoints requieren autenticaci&oacute;n ({@code @PreAuthorize("isAuthenticated()")}).
 * <p>
 * Base URL: {@code /api/v1/wishlist}
 */
@RestController
@RequestMapping("/api/v1/wishlist")
public class WishlistController {

    private final IWishlistService wishlistService;

    public WishlistController(IWishlistService wishlistService) {
        this.wishlistService = wishlistService;
    }

    /**
     * Agrega un producto a la wishlist del usuario autenticado.
     * <p>
     * Validaciones:
     * <ul>
     *   <li>Si el producto ya existe en la wishlist → {@code 400 PRODUCT_IN_WISHLIST}</li>
     *   <li>Si el usuario es registered y ya tiene 5 productos → {@code 400 WISHLIST_LIMIT}</li>
     * </ul>
     *
     * @param idProduct ID del producto a agregar
     * @return {@code 201 Created} con el {@link WishlistItemDTO} del item creado
     */
    @PostMapping("/product/{idProduct}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<WishlistItemDTO> addProductToWishlist(@PathVariable String idProduct) {
        WishlistItemDTO wishlistItem = wishlistService.addProductToWishlist(idProduct);
        return ResponseEntity.status(HttpStatus.CREATED).body(wishlistItem);
    }

    /**
     * Elimina un producto de la wishlist del usuario autenticado por productId
     * y retorna la informaci&oacute;n del item eliminado con el producto asociado.
     *
     * @param productId ID del producto a eliminar
     * @return {@code 200 OK} con el {@link WishlistProductDetailDTO} del item eliminado
     */
    @DeleteMapping("/product/{productId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<WishlistProductDetailDTO> removeProductFromWishlist(@PathVariable String productId) {
        WishlistProductDetailDTO removed = wishlistService.removeProductFromWishlist(productId);
        return ResponseEntity.ok(removed);
    }

    /**
     * Obtiene un wishlist item por productId para el usuario autenticado,
     * incluyendo la informaci&oacute;n del producto asociado.
     *
     * @param productId ID del producto
     * @return {@code 200 OK} con el {@link WishlistProductDetailDTO}
     */
    @GetMapping("/product/{productId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<WishlistProductDetailDTO> getWishlistItemByProductId(@PathVariable String productId) {
        WishlistProductDetailDTO detail = wishlistService.getWishlistItemByProductId(productId);
        return ResponseEntity.ok(detail);
    }

    /**
     * Obtiene los productos normalizados de la wishlist del usuario autenticado.
     * <p>
     * Query params:
     * <ul>
     *   <li>{@code sort} — {@code "recent"} (default, m&aacute;s recientes primero)
     *       o {@code "old"} (m&aacute;s antiguos primero)</li>
     *   <li>{@code limit} — n&uacute;mero m&aacute;ximo de productos a retornar (opcional)</li>
     * </ul>
     *
     * @param limit cantidad m&aacute;xima de productos (opcional)
     * @param sort  criterio de ordenamiento
     * @return {@code 200 OK} con la lista de productos normalizados
     */
    @GetMapping("/products")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<NormalizedProductDTO>> getNormalizedWishlistProducts(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "recent") String sort) {
        List<NormalizedProductDTO> products = wishlistService.getNormalizedWishlistProducts(limit, sort);
        return ResponseEntity.ok(products);
    }
}
