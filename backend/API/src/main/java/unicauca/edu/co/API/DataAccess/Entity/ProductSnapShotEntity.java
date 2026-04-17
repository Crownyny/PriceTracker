package unicauca.edu.co.API.DataAccess.Entity;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

/**
 * Entidad que representa un product_snapshot dentro de la BD, 
 * Es usada tambien para el HistroyPriceRepositroy 
 */

@Getter
@Setter
@AllArgsConstructor
public class ProductSnapShotEntity {
    private UUID id;
    private String productRef;
    private UUID productId;
    private Float price;
    private String currency;
    private Boolean availability;
    private LocalDateTime updatedAt;
    public ProductSnapShotEntity() {}
}
