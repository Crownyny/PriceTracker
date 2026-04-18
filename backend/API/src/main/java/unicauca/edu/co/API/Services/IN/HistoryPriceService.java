package unicauca.edu.co.API.Services.IN;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import unicauca.edu.co.API.DataAccess.Entity.ProductSnapShotEntity;
import unicauca.edu.co.API.DataAccess.Repository.ProductSnapShotRepository;
import unicauca.edu.co.API.Presentation.DTO.IN.HistoryPriceDTO;
import unicauca.edu.co.API.Presentation.Mapper.HistoryPriceMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IHistoryPriceService;
import unicauca.edu.co.API.Services.enums.Range;

/**
 * Implementación de la interfaz IHistoryPriceService para manejar el historial de precios de los productos.
 * Esta clase proporciona la lógica de negocio para obtener el historial de precios de un producto específico.
 * Se conecta al deamon product para el servicio del scrapper unico si es necesario.
 * Se conecta al ServiceAuthentication para validar el token de acceso.
 */

@Service
public class HistoryPriceService implements IHistoryPriceService {

    private final ProductSnapShotRepository ProductSanpShotRepository;
    private final HistoryPriceMapper historyPriceMapper;

    public HistoryPriceService(
        ProductSnapShotRepository ProductSanpShotRepository,
        HistoryPriceMapper historyPriceMapper
    ) {
        this.ProductSanpShotRepository = ProductSanpShotRepository;
        this.historyPriceMapper = historyPriceMapper;
    }

    @Override
    public HistoryPriceDTO getHistoryPrice(UUID productId, Range range) {
        if(range.isAll()) {
            List<ProductSnapShotEntity> history = ProductSanpShotRepository.findByProductId(productId);
            return historyPriceMapper.toDTO(history, range);
        }
        List<ProductSnapShotEntity> history = ProductSanpShotRepository.findByProductIdAndUpdatedAtAfter(productId, range.toDate());
        return historyPriceMapper.toDTO(history, range);
    }
}
