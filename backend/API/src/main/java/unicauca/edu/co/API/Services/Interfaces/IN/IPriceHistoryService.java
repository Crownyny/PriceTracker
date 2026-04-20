package unicauca.edu.co.API.Services.Interfaces.IN;

import java.util.UUID;


import unicauca.edu.co.API.Presentation.DTO.IN.PriceHistoryDTO;
import unicauca.edu.co.API.Presentation.DTO.IN.ProductPriceHistoryDTO;
import unicauca.edu.co.API.Services.enums.Range;

public interface IPriceHistoryService {
    /**
     * Lista el historial de precios de un producto. 
     * Con la posibilidad de filtrar por tiempo 
     * @param productId El ID del producto para el cual se desea obtener el historial de precios.
     * @param range El rango de tiempo para filtrar el historial de precios. Puede ser
     *  (1w)  1 semana 
     *  (3w)  3 semanas
     *  (12w) 3 meses
     *  (all) todo el tiempo
     * @return Un arreglo de HistoryPriceDTO que contiene el historial de precios del producto.
     */
    ProductPriceHistoryDTO getHistoryPrice(String productId, Range range );

}
