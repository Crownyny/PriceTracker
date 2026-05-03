package unicauca.edu.co.API.Presentation.DTO.IN;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

/**
 * DTO para representar un snapshot del precio de un producto.
 * 
 */
@AllArgsConstructor
@Getter
@Setter
public class PriceHistoryDTO {
    private Double  price;
    private String currency;
    private LocalDateTime recordedAt; 
    public PriceHistoryDTO() {}
}
