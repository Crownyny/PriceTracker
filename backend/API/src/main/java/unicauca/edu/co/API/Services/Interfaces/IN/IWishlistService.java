package unicauca.edu.co.API.Services.Interfaces.IN;

import java.util.List;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistProductDetailDTO;

/**
 * Puerto de entrada (inbound port) para operaciones de la lista de deseos (wishlist).
 * Define los casos de uso del m&oacute;dulo Wishlist siguiendo la arquitectura hexagonal.
 */
public interface IWishlistService {

    /**
     * Agrega un producto a la wishlist del usuario autenticado.
     *
     * @param productId ID del producto a agregar
     * @return DTO con los datos del wishlist item creado
     */
    WishlistItemDTO addProductToWishlist(String productId);

    /**
     * Obtiene los productos de la wishlist del usuario autenticado con
     * soporte para ordenamiento y límite.
     *
     * @param limit cantidad m&aacute;xima de productos a retornar (opcional)
     * @param sort  criterio de orden: {@code "recent"} (m&aacute;s recientes primero, default)
     *              o {@code "old"} (m&aacute;s antiguos primero)
     * @return lista de productos normalizados en la wishlist
     */
    List<NormalizedProductDTO> getNormalizedWishlistProducts(Integer limit, String sort);

    /**
     * Elimina un producto de la wishlist del usuario autenticado por productId.
     *
     * @param productId ID del producto a eliminar
     * @return DTO del wishlist item eliminado con la info del producto
     * @throws BusinessException si el producto no está en la wishlist
     */
    WishlistProductDetailDTO removeProductFromWishlist(String productId);

    /**
     * Obtiene un wishlist item por productId para el usuario autenticado,
     * incluyendo la informaci&oacute;n del producto asociado.
     *
     * @param productId ID del producto
     * @return DTO con los datos del wishlist item y el producto
     * @throws BusinessException si el producto no está en la wishlist
     */
    WishlistProductDetailDTO getWishlistItemByProductId(String productId);
}
