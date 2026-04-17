package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

/**
 * DTO para representar el historial de precios de un producto.
 * Esta ligado a una referencia de producto y la lista de los snapshots de precios asociados a esa referencia.
 */
@Getter
@Setter
@AllArgsConstructor
public class HistoryPriceDTO {
    private String productRef;
    private String productId;
    private String category;
    private SnapShotPriceDTO[] history;
    public HistoryPriceDTO() {}
}
