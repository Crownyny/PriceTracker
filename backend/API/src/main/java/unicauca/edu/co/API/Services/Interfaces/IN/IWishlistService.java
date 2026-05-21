package unicauca.edu.co.API.Services.Interfaces.IN;

import java.util.List;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;

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
}
