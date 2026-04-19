package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;

import unicauca.edu.co.API.DataAccess.Entity.PriceHistoryEntity;
import unicauca.edu.co.API.Presentation.DTO.IN.ProductPriceHistoryDTO;

@Mapper(componentModel = "spring")
public interface ProductSnapShotMapper {
    ProductPriceHistoryDTO toDTO(PriceHistoryEntity entity);
    PriceHistoryEntity toEntity(ProductPriceHistoryDTO dto);
}
