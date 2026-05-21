package unicauca.edu.co.API.Presentation.DTO.IN;

import com.google.auto.value.AutoValue.Builder;

import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class FilterAlertParamsDTO {
 
    /**
     * Cantidad máxima de alertas a retornar.
     * Opcional — si es null se retornan todas.
     */
    @Min(value = 1, message = "limit debe ser mayor a 0")
    private Integer limit;
 
    /**
     * Criterio de ordenamiento.
     * Valores soportados: "recent" (DESC) | "old" (ASC)
     * Opcional — si es null se usa "recent" por defecto.
     */
    private String sort;
 
    /**
     * Filtro por estado.
     * Valores soportados: "active" | "inactive"
     * Opcional — si es null se retornan ambos estados.
     */
    private String state;
}
