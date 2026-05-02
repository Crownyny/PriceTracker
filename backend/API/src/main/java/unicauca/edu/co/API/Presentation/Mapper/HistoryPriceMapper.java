package unicauca.edu.co.API.Presentation.Mapper;

import java.util.List;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.DataAccess.Entity.PriceHistoryEntity;
import unicauca.edu.co.API.Presentation.DTO.IN.PriceHistoryDTO;
import unicauca.edu.co.API.Presentation.DTO.IN.ProductPriceHistoryDTO;
import unicauca.edu.co.API.Services.enums.Range;

@Component
public class HistoryPriceMapper {
    private final ProductSnapShotMapper productSnapShotMapper;

    public HistoryPriceMapper(ProductSnapShotMapper productSnapShotMapper) {
        this.productSnapShotMapper = productSnapShotMapper;
    }

    public ProductPriceHistoryDTO toDTO(List<PriceHistoryEntity> entities, Range range) {

        if (entities == null || entities.isEmpty()) {
            throw new IllegalArgumentException(
                "No hay historial de precios para el producto al momento de convertir"
            );
        }

        var first = entities.get(0);

        var dto = new ProductPriceHistoryDTO();
        dto.setProductId(first.getProductId());
        dto.setCategory(range.name());
        
        dto.setHistory(
                entities.stream()
                        .map(productSnapShotMapper::toDTO)
                        .toList()
        );

        return dto;
    }
}


