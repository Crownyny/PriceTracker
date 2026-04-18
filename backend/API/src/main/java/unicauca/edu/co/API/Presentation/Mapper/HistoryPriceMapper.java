package unicauca.edu.co.API.Presentation.Mapper;

import java.util.List;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.DataAccess.Entity.ProductSnapShotEntity;
import unicauca.edu.co.API.Presentation.DTO.IN.HistoryPriceDTO;
import unicauca.edu.co.API.Presentation.DTO.IN.ProductSnapShotDTO;
import unicauca.edu.co.API.Services.enums.Range;

@Component
public class HistoryPriceMapper {
    private final ProductSnapShotMapper productSnapShotMapper;

    public HistoryPriceMapper(ProductSnapShotMapper productSnapShotMapper) {
        this.productSnapShotMapper = productSnapShotMapper;
    }

    public HistoryPriceDTO toDTO(List<ProductSnapShotEntity> entities, Range range) {

        if (entities == null || entities.isEmpty()) {
            throw new IllegalArgumentException(
                "No hay historial de precios para el producto al momento de convertir"
            );
        }

        var first = entities.get(0);

        var dto = new HistoryPriceDTO();
        dto.setProductId(first.getProductId());
        dto.setProductRef(first.getProductRef());
        dto.setCategory(range.name());

        dto.setHistory(
                entities.stream()
                        .map(productSnapShotMapper::toDTO)
                        .toArray(ProductSnapShotDTO[]::new)
        );

        return dto;
    }
}


