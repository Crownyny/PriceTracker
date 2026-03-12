package unicauca.edu.co.API.DataAccess.Entity;

import java.time.LocalDateTime;

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
 * Entidad que representa una entrada del historial de precios.
 * Se utiliza para mapear la información del historial de precios en la base de datos PostgreSQL.
 * Almacena los precios históricos de los productos rastreados a través del tiempo.
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

@Entity
@Table(name = "price_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PriceHistoryEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @Column(nullable = false)
    private String productRef;
    
    @Column(nullable = false)
    private String sourceName;
    
    @Column(nullable = false)
    private Double price;
    
    @Column(nullable = false, length = 10)
    private String currency;
    
    @Column(nullable = false)
    private LocalDateTime recordedAt;
    
    @Column(nullable = false)
    private String jobId;
}
