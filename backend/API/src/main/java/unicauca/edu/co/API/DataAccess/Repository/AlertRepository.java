package unicauca.edu.co.API.DataAccess.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;

@Repository
public interface AlertRepository extends JpaRepository<AlertEntity, UUID> {
    /**
     * Encuentra todas las alertas de un usuario específico.
     * @param userId ID del usuario propietario
     * @return Lista de alertas del usuario
     */
    List<AlertEntity> findByUserId(UUID userId);

    /**
     * Encuentra todas las alertas de un producto específico.
     * @param productId ID del producto
     * @return Lista de alertas del producto
     */
    List<AlertEntity> findByProductId(String productId);
    /**
     * Encuentra todas las alertas activas.
     * @return
     */
    List<AlertEntity> findByIsActiveTrue();

    /**
     * Cuenta todas las alertas activas.
     */
    long countByIsActiveTrue();

    /**
     * Cuenta alertas activas por frecuencia.
     */
    long countByIsActiveTrueAndFrequency(AlertEntity.AlertFrequency frequency);
    
    /**
     * Encuentra una alerta por productId y userId para asegurar que pertenece al usuario.
     * @param productId ID del producto
     * @param userId ID del usuario propietario
     * @return Optional con la alerta si existe y pertenece al usuario
     */
    Optional<AlertEntity> findByProductIdAndUserId(String productId, UUID userId);
    
    /**
     * Encuentra todas las alertas activas para un usuario específico.
     * @param userId ID del usuario propietario
     * @return Lista de alertas activas del usuario
     */
    List<AlertEntity> findByUserIdAndIsActiveTrue(UUID userId);
    
    /**
     * Encuentra todas las alertas para un usuario específico.
     * @param userId ID del usuario propietario
     * @return Lista de alertas del usuario
     */
    List<AlertEntity> findByUserIdOrderByCreateAtDesc(UUID userId);

    /**
     * Verifica si existe una alerta para un producto específico y un usuario específico.
     * @param userId ID del usuario propietario
     * @param productId ID del producto
     * @return true si existe una alerta para el producto y usuario, false en caso contrario
     */
    boolean existsByUserIdAndProductId(UUID userId, String productId);
}
