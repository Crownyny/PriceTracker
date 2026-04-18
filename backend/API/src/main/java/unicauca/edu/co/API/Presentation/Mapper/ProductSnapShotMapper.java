package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;

import unicauca.edu.co.API.DataAccess.Entity.ProductSnapShotEntity;
import unicauca.edu.co.API.Presentation.DTO.IN.ProductSnapShotDTO;

@Mapper(componentModel = "spring")
public interface ProductSnapShotMapper {
    ProductSnapShotDTO toDTO(ProductSnapShotEntity entity);
    ProductSnapShotEntity toEntity(ProductSnapShotDTO dto);
}
