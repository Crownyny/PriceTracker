package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.Presentation.DTO.NormalizedProductDTO;

/**
 * Mapper para NormalizedProduct.
 * Implementa GenericMapper usando MapStruct.
 */
@Mapper(componentModel = "spring")
public interface NormalizedProductMapper extends GenericMapper<NormalizedProductEntity, NormalizedProductDTO> {

}
