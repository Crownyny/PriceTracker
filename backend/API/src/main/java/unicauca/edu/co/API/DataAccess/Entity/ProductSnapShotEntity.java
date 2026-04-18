package unicauca.edu.co.API.DataAccess.Entity;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

/**
 * Entidad que representa un product_snapshot dentro de la BD, 
 * Es usada tambien para el HistroyPriceRepositroy 
 */
@Entity
@Getter
@Setter
@AllArgsConstructor
public class ProductSnapShotEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private UUID id;
    private String productRef;
    private UUID productId;
    private Float price;
    private String currency;
    private Boolean availability;
    private LocalDateTime updatedAt;
    public ProductSnapShotEntity() {}
}
