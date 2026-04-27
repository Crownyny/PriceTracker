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
    @Mapping(target = "confidence", ignore = true)
    NormalizedProductDTO toDTO(NormalizedProductEntity entity);

    @Mapping(target = "lastScrapedAt", ignore = true)
    @Mapping(target = "nextScrapeAt", ignore = true)
    @Mapping(target = "volatilityScore", ignore = true)
    @Mapping(target = "alertPriority", ignore = true)
    @Mapping(target = "lockedUntil", ignore = true)
    @Mapping(target = "alerts", ignore = true)
    @Mapping(target = "notifications", ignore = true)
    NormalizedProductEntity toEntity(NormalizedProductDTO dto);
}
