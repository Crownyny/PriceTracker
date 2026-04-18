package unicauca.edu.co.API.Services.IN;

import org.springframework.stereotype.Service;

import unicauca.edu.co.API.Presentation.DTO.IN.HistoryPriceDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IHistoryPriceService;

/**
 * Implementación de la interfaz IHistoryPriceService para manejar el historial de precios de los productos.
 * Esta clase proporciona la lógica de negocio para obtener el historial de precios de un producto específico.
 * Se conecta al deamon product para el servicio del scrapper unico si es necesario.
 * Se conecta al ServiceAuthentication para validar el token de acceso.
 */

@Service
public class HistoryPriceService implements IHistoryPriceService {


    @Override
    public HistoryPriceDTO[] getHistoryPrice(String productId, String range) {
        return new HistoryPriceDTO[0];
    }

}
