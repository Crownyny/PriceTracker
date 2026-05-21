package unicauca.edu.co.API.Presentation.DTO.IN;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FilterParamsDTO {
    // Filtros que vienen por QueryParams
    private String sortBy;        // name, price, createdAt
    private String order;         // asc, desc
    private Double minPrice;
    private Double maxPrice;
    private String sourceName;         // Amazon, MercadoLibre, Ebay
    private Integer limit;  
}
