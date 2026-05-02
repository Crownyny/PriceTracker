package unicauca.edu.co.API.Services.IN;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.google.firebase.database.annotations.NotNull;

import jakarta.persistence.EntityNotFoundException;
import unicauca.edu.co.API.Config.Security.AuthenticatedUserPrincipal;
import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Entity.UserEntity;
import unicauca.edu.co.API.DataAccess.Entity.AlertEntity.AlertFrequency;
import unicauca.edu.co.API.DataAccess.Repository.AlertRepository;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.DataAccess.Repository.UserRepository;
import unicauca.edu.co.API.Presentation.DTO.IN.AlertDTO;
import unicauca.edu.co.API.Presentation.DTO.IN.AlertRequestDTO;
import unicauca.edu.co.API.Presentation.Mapper.AlertMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IAlertService;

/**
 * Servicio de Alertas.
 * Implementa la lógica de negocio para la gestión de alertas de precios con validación de userId.
 */
@Service
public class AlertService implements IAlertService {
    @NotNull
    private final AlertRepository alertRepository;
    private final AlertMapper alertMapper;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public AlertService(
        AlertRepository alertRepository,
         AlertMapper alertMapper,
         ProductRepository productRepository,
         UserRepository userRepository
        ) {
        this.alertRepository = alertRepository;
        this.alertMapper = alertMapper;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    @Override
    public AlertDTO createAlert(AlertFrequency frequency, String productId) {
        UUID userId = getCurrentUserId();
        NormalizedProductEntity product = productRepository.findById(productId)
            .orElseThrow(() -> new EntityNotFoundException("Product not found with id: " + productId));
        validateAlertDoesNotExist(userId, productId);
        validateAlertLimit(userId);
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found with id: " + userId));
        AlertEntity alert = buildAlertEntity(product, frequency, productId, user);
        AlertEntity savedAlert = alertRepository.save(alert);
        return alertMapper.toDTO(savedAlert);
    }

    @Override
    public AlertDTO getAlertById(UUID alertId) {
        UUID userId = getCurrentUserId();
        return alertRepository.findById(alertId)
            .map(alertMapper::toDTO)
            .orElseThrow(() -> new EntityNotFoundException(
                "Alert not found for alertId: " + alertId + " and userId: " + userId
            ));
    }

    @Override
    public AlertDTO updateAlert(UUID alertId, AlertRequestDTO alertDTO) {
        UUID userId = getCurrentUserId();
        return alertRepository.findByIdAndDeletedAtIsNull(alertId)
            .map(alertEntity -> {
                alertEntity.setFrequency(alertDTO.getFrequency());
                AlertEntity updatedAlert = alertRepository.save(alertEntity);
                return alertMapper.toDTO(updatedAlert);
            })
            .orElseThrow(() -> new EntityNotFoundException(
                "Alert not found for alertId: " + alertId + " and userId: " + userId
            ));
    }

    @Override
    public AlertDTO updateAlertStatus(UUID alertId, Boolean isActive) {
        UUID userId = getCurrentUserId();
        System.out.println("Updating alert status for alertId: " + alertId + ", userId: " + userId + ", isActive: " + isActive);
        return alertRepository.findById(alertId)
            .map(alertEntity -> {
                validateStatusChange(alertEntity.getIsActive(), isActive);

                alertEntity.setIsActive(isActive);
                AlertEntity updatedAlert = alertRepository.save(alertEntity);
                return alertMapper.toDTO(updatedAlert);
            })
            .orElseThrow(() -> new EntityNotFoundException(
                "Alert not found for alertId: " + alertId + " and userId: " + userId
            ));
    }

    @Override
    public AlertDTO deleteAlert(UUID alertId) {
        UUID userId = getCurrentUserId();
        return alertRepository.findById(alertId)
            .map(alertEntity -> {
                alertEntity.setIsActive(false);
                alertEntity.setDeletedAt(LocalDateTime.now());
                AlertDTO dto = alertMapper.toDTO(alertEntity);
                alertRepository.save(alertEntity);
                return dto;
            })
            .orElseThrow(() -> new EntityNotFoundException(
                "Alert not found for alertId: " + alertId + " and userId: " + userId
            ));
    }

    @Override
    public List<AlertDTO> getAllAlerts() {
        UUID userId = getCurrentUserId();
        List<AlertEntity> alerts = alertRepository.findByUserIdAndDeletedAtIsNull(userId);
        return alerts.stream()
            .map(alertMapper::toDTO)
            .collect(Collectors.toList());
    }

    /**
     * Construye una nueva instancia de AlertEntity con los datos proporcionados.
     * @param frequency La frecuencia de la alerta
     * @param productId El ID del producto asociado a la alerta
     * @param userId El ID del usuario que crea la alerta
     * @return  Una nueva instancia de AlertEntity con los datos proporcionados y valores predeterminados para los campos restantes
     */
    private AlertEntity buildAlertEntity(NormalizedProductEntity product, AlertFrequency frequency, String productId, UserEntity user) {
        System.out.println("Building AlertEntity");
        AlertEntity alertEntity = new AlertEntity();
        alertEntity.setFrequency(frequency);
        alertEntity.setProductId(productId);
        alertEntity.setUserId(user.getId());
        alertEntity.setIsActive(true);
        alertEntity.setCreateAt(LocalDateTime.now());
        alertEntity.setProduct(product);
        alertEntity.setUser(user);
        System.out.println("AlertEntity built successfully");
        return alertEntity;
    }

    
    /**
     * Obtiene el ID del usuario actualmente autenticado a través del contexto de seguridad de Spring Security.
     * Si el usuario no está autenticado, se lanza una excepción.
      * @return El ID del usuario actualmente autenticado
     */
    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext()
            .getAuthentication()
            .getPrincipal();

        if (principal instanceof AuthenticatedUserPrincipal user) {
            return user.id(); 
        }

        throw new IllegalStateException("User not authenticated");
    }
    /**
     * Valida que el usuario no haya alcanzado el límite de alertas activas permitidas para usuarios con rol "registered". Si el usuario tiene 3 o más alertas activas,
     * se lanza una excepción indicando que se ha alcanzado el máximo de alertas para usuarios freemium.
     * @param userId El ID del usuario para el cual se desea validar el límite de alertas
     */
    private void validateAlertLimit(UUID userId) {
        List<AlertDTO> userAlerts = getAllAlerts();
        if (userAlerts.size() >= 3 && userRepository.getReferenceById(userId).getRole() == UserEntity.UserRole.registered) {
            throw new IllegalStateException("MAXIMO ALERTAS ALCANZADO POR FREEMIUM");
        }
    }
    /**
     * Valida que no exista una alerta activa para el mismo producto y usuario. Si ya existe una alerta para el producto y usuario proporcionados
     * se lanza una excepción indicando que la alerta ya existe.
     * @param userId
     * @param productId
     */
    private void validateAlertDoesNotExist(UUID userId, String productId) {
            boolean exists = alertRepository
        .existsByUserIdAndProductIdAndDeletedAtIsNull(userId, productId);

        System.out.println("Validating alert existence for userId: " + userId + ", productId: " + productId + ", exists: " + exists);
        if (exists) {
            throw new IllegalStateException("Alert already exists for this product and user");
        }
    }
    /**
     * Valida que el cambio de estado de la alerta sea diferente al estado actual. Si el estado actual y el estado entrante son iguales, 
     * se lanza una excepción indicando que la alerta ya tiene este estado.
     * @param current El estado actual de la alerta
     * @param incoming El nuevo estado que se desea establecer para la alerta
     */

    private void validateStatusChange(Boolean current, Boolean incoming) {
        if (Objects.equals(current, incoming)) {
            throw new IllegalStateException("Alert already has this status");
        }
    }

}
