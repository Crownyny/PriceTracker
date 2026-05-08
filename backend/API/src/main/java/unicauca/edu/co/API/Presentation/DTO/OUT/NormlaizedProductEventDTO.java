package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
/**
 * DTO para representar un evento de finalización de normalización de productos.
 * Mapea los nombres en snake_case de Python a camelCase de Java.
 */
public class NormlaizedProductEventDTO {
    @JsonProperty("search_id")
    private String searchId;
    
    @JsonProperty("product_ref")
    private String productRef;
    
    @JsonProperty("total_normalized")
    private int totalNormalized;
    
    @JsonProperty("completed_at")
    private LocalDateTime completedAt;
    
    @JsonProperty("is_update")
    private Boolean update;
    
    public NormlaizedProductEventDTO() {
    }
}
