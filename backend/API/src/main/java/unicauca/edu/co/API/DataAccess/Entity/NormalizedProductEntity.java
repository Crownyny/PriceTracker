package unicauca.edu.co.API.DataAccess.Entity;

import java.time.LocalDateTime;
import java.util.Map;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 
 * Entity para representar un producto normalizado con información detallada.
 * Se usara para mapear la información del producto normalizado en la base de datos.
 * Se usara cada vez que se consulte un producto normalizado, con el fin de mostrar toda la información relevante al usuario.
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

@Entity
@Table(name = "normalized_products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class NormalizedProductEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @Column(nullable = false)
    private String productRef;
    
    @Column(nullable = false)
    private String sourceName;
    
    @Column(nullable = false)
    private String canonicalName;
    
    @Column(nullable = false)
    private Double price;
    
    @Column(nullable = false, length = 10)
    private String currency;
    
    @Column(nullable = false)
    private String category;
    
    @Column(nullable = false)
    private Boolean availability;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @Column
    private String imageUrl;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(columnDefinition = "jsonb")
    private Map<String, String> extra;
}
