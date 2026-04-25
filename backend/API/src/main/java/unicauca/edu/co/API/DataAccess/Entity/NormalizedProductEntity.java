package unicauca.edu.co.API.DataAccess.Entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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
@AllArgsConstructor
public class NormalizedProductEntity {
    @Id
    @Column(length = 36)
    private String id;
    
    @Column(name = "product_ref")
    private String productRef;
    
    @Column(name = "source_name")
    private String sourceName;

    @Column(name = "source_url", nullable = false)
    private String sourceUrl;
    
    @Column(name = "canonical_name")
    private String canonicalName;
    
    private Double price;
    private String currency;
    private String category;
    private Boolean availability;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_scraped_at")
    private LocalDateTime lastScrapedAt;

    @Column(name = "next_scrape_at")
    private LocalDateTime nextScrapeAt;

    @Column(name = "volatility_score")
    private Double volatilityScore;

    @Column(name = "alert_priority")
    private Integer alertPriority;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;
    
    @Column(name = "image_url")
    private String imageUrl;
    
    private String description;
    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> extra;

    @OneToMany(mappedBy = "product")
    private List<AlertEntity> alerts = new ArrayList<>();

    @OneToMany(mappedBy = "listing")
    private List<NotificationEntity> notifications = new ArrayList<>();

    // Constructor sin argumentos para JPA
    public NormalizedProductEntity() {
    }
}
