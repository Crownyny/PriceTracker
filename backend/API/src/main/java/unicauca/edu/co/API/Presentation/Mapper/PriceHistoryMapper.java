package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;

import unicauca.edu.co.API.DataAccess.Entity.PriceHistoryEntity;
import unicauca.edu.co.API.Presentation.DTO.OUT.PriceHistoryDTO;

/**
 * Mapper para PriceHistory.
 * Implementa GenericMapper usando MapStruct.
 */
@Mapper(componentModel = "spring")
public interface PriceHistoryMapper extends GenericMapper<PriceHistoryEntity, PriceHistoryDTO> {

}
