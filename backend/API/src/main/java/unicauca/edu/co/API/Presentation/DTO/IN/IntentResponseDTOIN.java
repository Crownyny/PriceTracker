package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class IntentResponseDTOIN {
    private String input;
    /** Coincide con el JSON numérico de microServiceModelProduct (/predict). */
    private Double p_buy;
    private String label;
    private Double threshold;
    public IntentResponseDTOIN() {
    }   
}
