package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;

import unicauca.edu.co.API.DataAccess.Entity.SearchTrackingEntity;
import unicauca.edu.co.API.Presentation.DTO.SearchTrackingDTO;

/**
 * Mapper para SearchTracking.
 * Implementa GenericMapper usando MapStruct.
 */
@Mapper(componentModel = "spring")
public interface SearchTrackingMapper extends GenericMapper<SearchTrackingEntity, SearchTrackingDTO> {

}
