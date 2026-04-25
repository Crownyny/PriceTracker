package unicauca.edu.co.API.Services.IN;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.google.firebase.database.annotations.NotNull;

import jakarta.persistence.EntityNotFoundException;
import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Entity.AlertEntity.AlertFrequency;
import unicauca.edu.co.API.DataAccess.Repository.AlertRepository;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.Presentation.DTO.IN.AlertDTO;
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

    public AlertService(
        AlertRepository alertRepository,
         AlertMapper alertMapper,
         ProductRepository productRepository    
        ) {
        this.alertRepository = alertRepository;
        this.alertMapper = alertMapper;
        this.productRepository = productRepository;
    }

    @Override
    public AlertDTO createAlert(AlertFrequency frequency, String productId, UUID userId) {
        AlertEntity alertEntity = new AlertEntity();
        NormalizedProductEntity productEntity = productRepository.findById(productId)
            .orElseThrow(() -> new EntityNotFoundException("Product not found with id: " + productId));
        boolean exists = alertRepository.existsByUserIdAndProductId(userId, productId);
        if (exists) {
            throw new IllegalStateException("Alert already exists for this product and user");
        }
        alertEntity = buildAlertEntity(productEntity, frequency, productId, userId);
        AlertEntity savedAlert = alertRepository.save(alertEntity);
        return alertMapper.toDTO(savedAlert);
    }

    @Override
    public AlertDTO getAlertById(String productId, UUID userId) {
        return alertRepository.findByProductIdAndUserId(productId, userId)
            .map(alertMapper::toDTO)
            .orElseThrow(() -> new EntityNotFoundException(
                "Alert not found for productId: " + productId + " and userId: " + userId
            ));
    }
    
    @Override
    public AlertDTO updateAlert(String productId, UUID userId, AlertDTO alertDTO) {
        return alertRepository.findByProductIdAndUserId(productId, userId)
            .map(alertEntity -> {
                alertEntity.setCondition(alertDTO.getCondition());
                alertEntity.setFrequency(alertDTO.getFrequency());
                AlertEntity updatedAlert = alertRepository.save(alertEntity);
                return alertMapper.toDTO(updatedAlert);
            })
            .orElseThrow(() -> new EntityNotFoundException(
                "Alert not found for productId: " + productId + " and userId: " + userId
            ));
    }

    @Override
    public AlertDTO updateAlertStatus(String productId, UUID userId, Boolean isActive) {
        return alertRepository.findByProductIdAndUserId(productId, userId)
            .map(alertEntity -> {
                validateStatusChange(alertEntity.getIsActive(), isActive);
                alertEntity.setIsActive(isActive);
                AlertEntity updatedAlert = alertRepository.save(alertEntity);
                return alertMapper.toDTO(updatedAlert);
            })
            .orElseThrow(() -> new EntityNotFoundException(
                "Alert not found for productId: " + productId + " and userId: " + userId
            ));
    }

    @Override
    public AlertDTO deleteAlert(String productId, UUID userId) {
        return alertRepository.findByProductIdAndUserId(productId, userId)
            .map(alertEntity -> {
                AlertDTO dto = alertMapper.toDTO(alertEntity);
                alertRepository.delete(alertEntity);
                return dto;
            })
            .orElseThrow(() -> new EntityNotFoundException(
                "Alert not found for productId: " + productId + " and userId: " + userId
            ));
    }

    @Override
    public List<AlertDTO> getAllAlerts(UUID userId) {
        List<AlertEntity> alerts = alertRepository.findByUserIdAndIsActiveTrue(userId);
        return alerts.stream()
            .map(alertMapper::toDTO)
            .collect(Collectors.toList());
    }

    private void validateStatusChange(Boolean current, Boolean incoming) {
        if (Objects.equals(current, incoming)) {
            throw new IllegalStateException("Alert already has this status");
        }
    }
    /**
     * Construye una nueva instancia de AlertEntity con los datos proporcionados.
     * @param frequency La frecuencia de la alerta
     * @param productId El ID del producto asociado a la alerta
     * @param userId El ID del usuario que crea la alerta
     * @return  Una nueva instancia de AlertEntity con los datos proporcionados y valores predeterminados para los campos restantes
     */
    private AlertEntity buildAlertEntity(NormalizedProductEntity product,  AlertFrequency frequency, String productId, UUID userId) {
        AlertEntity alertEntity = new AlertEntity();
        alertEntity.setFrequency(frequency);
        alertEntity.setProductId(productId);
        alertEntity.setUserId(userId);
        alertEntity.setIsActive(true);
        alertEntity.setCreateAt(LocalDateTime.now());
        alertEntity.setProduct(product);    
        return alertEntity; 
    }
}
