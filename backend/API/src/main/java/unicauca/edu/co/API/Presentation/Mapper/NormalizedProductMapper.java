package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;

/**
 * Mapper para NormalizedProduct.
 * Implementa GenericMapper usando MapStruct.
 */
@Mapper(componentModel = "spring")
public interface NormalizedProductMapper extends GenericMapper<NormalizedProductEntity, NormalizedProductDTO> {
    @Mapping(target = "scrapedAt", ignore = true)
    @Mapping(target = "sourceUrl", ignore = true)
    @Mapping(target = "confidence", ignore = true)
    NormalizedProductDTO toDTO(NormalizedProductEntity entity);
}
