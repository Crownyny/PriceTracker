package unicauca.edu.co.API.Services.IN;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;



import unicauca.edu.co.API.Config.Security.AuthenticatedUserPrincipal;
import unicauca.edu.co.API.DataAccess.Entity.PriceHistoryEntity;
import unicauca.edu.co.API.DataAccess.Repository.PriceHistoryRepository;
import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Presentation.DTO.IN.ProductPriceHistoryDTO;
import unicauca.edu.co.API.Presentation.Mapper.HistoryPriceMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IPriceHistoryService;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;
import unicauca.edu.co.API.Services.enums.Range;
import unicauca.edu.co.API.Domain.Model.UserRole;

/**,
 * Implementación de la interfaz IHistoryPriceService para manejar el historial de precios de los productos.
 * Esta clase proporciona la lógica de negocio para obtener el historial de precios de un producto específico.
 * Se conecta al deamon product para el servicio del scrapper unico si es necesario.
 * Se conecta al ServiceAuthentication para validar el token de acceso.
 */

@Service
public class HistoryPriceService implements IPriceHistoryService {

    private final PriceHistoryRepository priceHistoryRepository;
    private final HistoryPriceMapper historyPriceMapper;
    private final IUserService userService;


    public HistoryPriceService(
        PriceHistoryRepository priceHistoryRepository,
        HistoryPriceMapper historyPriceMapper,
        IUserService userService
    ) {
        this.priceHistoryRepository = priceHistoryRepository;
        this.historyPriceMapper = historyPriceMapper;
        this.userService = userService;
    }
    @Override
    public ProductPriceHistoryDTO getHistoryPrice(String productId, Range range) {
        UUID currentUserId = getCurrentUserId();
        boolean isFreemium = validatedUserAccessFremium(currentUserId);
        LocalDateTime fromDate;
        if (isFreemium && range != Range.W1) {
            throw new IllegalArgumentException(
                "USUARIO FREMIUM SOLO PUEDE ACCEDER AL HISTORIAL DE PRECIOS DE LA SEMANA PASADA"
            );
        } else {
            fromDate = range.toDate();
        }
        List<PriceHistoryEntity> history;
        if (fromDate == null) {
            history = priceHistoryRepository.findByProductId(productId);
        } else {
            history = priceHistoryRepository
                    .findByProductIdAndRecordedAtAfter(productId, fromDate);
        }
        return historyPriceMapper.toDTO(history, range);
    }

    /**
     * Valida si el usuario es fremium o premium
     * @param userId id del usuario a validar
     * @return true si el usuario es fremium o premium, false en caso contrario
     */ 
    private boolean validatedUserAccessFremium(UUID currentUserId) {
        
        User user = userService.findById(currentUserId);
        if(user != null) {
            return user.getRole() == UserRole.registered;
        }
        return false;   

    }

    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext()
            .getAuthentication()
            .getPrincipal();

        if (principal instanceof AuthenticatedUserPrincipal user) {
            return user.id(); 
        }

        throw new IllegalStateException("User not authenticated");
    }
}
