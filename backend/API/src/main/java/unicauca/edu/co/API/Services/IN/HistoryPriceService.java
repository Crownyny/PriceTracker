package unicauca.edu.co.API.Services.IN;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import unicauca.edu.co.API.DataAccess.Entity.PriceHistoryEntity;
import unicauca.edu.co.API.DataAccess.Repository.PriceHistoryRepository;
import unicauca.edu.co.API.Presentation.DTO.IN.ProductPriceHistoryDTO;
import unicauca.edu.co.API.Presentation.Mapper.HistoryPriceMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IPriceHistoryService;
import unicauca.edu.co.API.Services.enums.Range;

/**
 * Implementación de la interfaz IHistoryPriceService para manejar el historial de precios de los productos.
 * Esta clase proporciona la lógica de negocio para obtener el historial de precios de un producto específico.
 * Se conecta al deamon product para el servicio del scrapper unico si es necesario.
 * Se conecta al ServiceAuthentication para validar el token de acceso.
 */

@Service
public class HistoryPriceService implements IPriceHistoryService {

    private final PriceHistoryRepository priceHistoryRepository;
    private final HistoryPriceMapper historyPriceMapper;

    public HistoryPriceService(
        PriceHistoryRepository priceHistoryRepository,
        HistoryPriceMapper historyPriceMapper
    ) {
        this.priceHistoryRepository = priceHistoryRepository;
        this.historyPriceMapper = historyPriceMapper;
    }

    @Override
    public ProductPriceHistoryDTO getHistoryPrice(String productId, Range range) {
        if(range.isAll()) {
            List<PriceHistoryEntity> history = priceHistoryRepository.findByProductId(productId);
            return historyPriceMapper.toDTO(history, range);
        }
        List<PriceHistoryEntity> history = priceHistoryRepository.findByProductIdAndRecordedAtAfter(productId, range.toDate());
        return historyPriceMapper.toDTO(history, range);
    }

    
}
