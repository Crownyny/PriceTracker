package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO para representar una entrada del historial de precios.
 * Se utiliza para transferir la información del historial de precios entre
 * la capa de aplicación y la capa de presentación.
 */

/**
 * @Param id: Identificador único de la entrada del historial de precios.
 * @Param productRef: Referencia del producto.
 * @Param sourceName: Nombre de la fuente (tienda) de donde se obtuvo el precio.
 * @Param price: Precio del producto en el momento del registro.
 * @Param currency: Moneda del precio.
 * @Param recordedAt: Fecha y hora en que se registró el precio.
 * @Param jobId: Identificador del trabajo o tarea que generó este registro.
 */

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PriceHistoryDTO {
    
    private Integer id;
    private String productRef;
    private String sourceName;
    private Double price;
    private String currency;
    private LocalDateTime recordedAt;
    private String jobId;
}
