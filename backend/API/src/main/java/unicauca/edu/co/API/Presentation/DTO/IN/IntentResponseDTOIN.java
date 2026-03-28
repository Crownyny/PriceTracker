package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class IntentResponseDTOIN {
    private String input;
    private String p_buy;
    private String label;
    private String threshold;
    public IntentResponseDTOIN() {
    }   
}
