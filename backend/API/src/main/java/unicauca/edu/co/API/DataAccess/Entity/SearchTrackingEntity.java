package unicauca.edu.co.API.DataAccess.Entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entidad que representa el rastreo de búsquedas.
 * Se utiliza para mapear la información del rastreo de búsquedas en la base de datos PostgreSQL.
 * Almacena el estado de las búsquedas de productos y el progreso de los trabajos asociados.
 */

/**
 * @Param searchId: Identificador único de la búsqueda.
 * @Param productRef: Referencia del producto a rastrear.
 * @Param expectedJobs: Número esperado de trabajos (scraping) para esta búsqueda.
 * @Param completedJobs: Número de trabajos completados.
 * @Param createdAt: Fecha y hora de creación del rastreo.
 * @Param updatedAt: Fecha y hora de la última actualización del rastreo.
 */

@Entity
@Table(name = "search_tracking")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SearchTrackingEntity {
    
    @Id
    @Column(name = "search_id", nullable = false)
    private String searchId;
    
    @Column(name = "product_ref", nullable = false)
    private String productRef;
    
    @Column(name = "expected_jobs")
    private Integer expectedJobs;
    
    @Column(name = "completed_jobs", nullable = false)
    private Integer completedJobs;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
