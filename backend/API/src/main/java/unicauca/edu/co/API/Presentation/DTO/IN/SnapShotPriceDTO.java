package unicauca.edu.co.API.Presentation.DTO.IN;

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
public class SnapShotPriceDTO {
    private String price;
    private String currency;
    private String availability;
    private String updateAt; 
    public SnapShotPriceDTO() {}   
}
