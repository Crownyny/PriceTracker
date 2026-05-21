package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;

import unicauca.edu.co.API.Domain.Model.WishlistItem;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;

/**
 * Mapper de MapStruct para convertir entre {@link WishlistItem} (dominio)
 * y {@link WishlistItemDTO} (DTO de salida).
 */
@Mapper(componentModel = "spring")
public interface WishlistMapper extends GenericMapper<WishlistItem, WishlistItemDTO> {
    WishlistItemDTO toDTO(WishlistItem wishlistItem);
    WishlistItem toEntity(WishlistItemDTO wishlistItemDTO);
}
