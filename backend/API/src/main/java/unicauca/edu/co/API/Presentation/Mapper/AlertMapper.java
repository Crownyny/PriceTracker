package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;
import unicauca.edu.co.API.Presentation.DTO.IN.AlertDTO;

/**
 * Mapper para Alert.
 * Implementa GenericMapper usando MapStruct.
 */
@Mapper(componentModel = "spring")
public interface AlertMapper extends GenericMapper<AlertEntity, AlertDTO> {
    @Mapping(target = "notifications", ignore = true)
    AlertDTO toDTO(AlertEntity entity);
    @Mapping(target = "user", ignore = true)
    @Mapping(target = "product", ignore = true)
    @Mapping(target = "notifications", ignore = true)
    AlertEntity toEntity(AlertDTO dto);

}
