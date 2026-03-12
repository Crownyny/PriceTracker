package unicauca.edu.co.API.Presentation.DTO;

import java.time.LocalDateTime;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor

/**
 * DTO para representar un producto normalizado con información detallada.
 * Se enviara cada vez que se consulte un producto normalizado, con el fin de mostrar toda la información relevante al usuario.
 */

/**
 * @Param id: Identificador único del producto normalizado.
 * @Param productRef: Referencia del producto.
 * @Param sourceName: Nombre de la fuente (tienda) de donde se obtuvo el producto.
 * @Param canonicalName: Nombre  del producto normalizado.
 * @Param price: Precio del producto normalizado.
 * @Param currency: Moneda del precio.
 * @Param category: Categoría del producto normalizado. 
 * @Param availability: Disponibilidad del producto normalizado.
 * @Param updatedAt: Fecha y hora de la última actualización del producto normalizado.
 * @Param imageUrl: URL de la imagen del producto normalizado.
 * @Param description: Descripción del producto normalizado.
 * @Param extra: Información adicional del producto normalizado, como características específicas o atributos personalizados.
 */

public class NormalizedProductDTO {
    private Integer id;
    private String productRef;
    private String sourceName;
    private String canonicalName;
    private Double price;
    private String currency;
    private String category;
    private Boolean availability;
    private LocalDateTime updatedAt;
    private String imageUrl;
    private String description;
    private Map<String, String> extra;

    public NormalizedProductDTO() {
    }   
}
