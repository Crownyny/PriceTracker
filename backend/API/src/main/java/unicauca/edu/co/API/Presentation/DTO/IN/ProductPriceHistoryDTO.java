package unicauca.edu.co.API.Presentation.DTO.IN;

import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO para representar el historial de precios de un producto.
 * Esta ligado a una referencia de producto y la lista de los snapshots de precios asociados a esa referencia.
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ProductPriceHistoryDTO {
    private String productId;
    private String category;
    private List<PriceHistoryDTO> history;
}
