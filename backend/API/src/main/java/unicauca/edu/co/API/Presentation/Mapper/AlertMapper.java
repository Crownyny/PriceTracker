package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;
import unicauca.edu.co.API.Presentation.DTO.IN.AlertDTO;

/**
 * Mapper para Alert.
 * Implementa GenericMapper usando MapStruct.
 */
@Mapper(componentModel = "spring")
public interface AlertMapper extends GenericMapper<AlertEntity, AlertDTO> {
    AlertDTO toDTO(AlertEntity entity);
    AlertEntity toEntity(AlertDTO dto);
}
