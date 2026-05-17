package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;

import unicauca.edu.co.API.Domain.Model.WishlistItem;
import unicauca.edu.co.API.Presentation.DTO.OUT.WishlistItemDTO;

@Mapper(componentModel = "spring")
public interface WishlistMapper extends GenericMapper<WishlistItem, WishlistItemDTO> {
    WishlistItemDTO toDTO(WishlistItem wishlistItem);
    WishlistItem toEntity(WishlistItemDTO wishlistItemDTO);
}
