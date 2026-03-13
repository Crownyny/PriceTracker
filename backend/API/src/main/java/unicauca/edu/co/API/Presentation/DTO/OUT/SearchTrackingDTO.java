package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO para representar el rastreo de búsquedas.
 * Se utiliza para transferir la información del rastreo de búsquedas entre
 * la capa de aplicación y la capa de presentación.
 */

/**
 * @Param searchId: Identificador único de la búsqueda.
 * @Param productRef: Referencia del producto a rastrear.
 * @Param expectedJobs: Número esperado de trabajos (scraping) para esta búsqueda.
 * @Param completedJobs: Número de trabajos completados.
 * @Param createdAt: Fecha y hora de creación del rastreo.
 * @Param updatedAt: Fecha y hora de la última actualización del rastreo.
 */

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SearchTrackingDTO {
    
    private String searchId;
    private String productRef;
    private Integer expectedJobs;
    private Integer completedJobs;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
