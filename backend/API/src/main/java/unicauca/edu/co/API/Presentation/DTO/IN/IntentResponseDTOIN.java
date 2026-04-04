package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
/**
 * DTO de entrada para la respuesta de intención. Contiene el input del usuario, la probabilidad de compra, la etiqueta de intención y el umbral de decisión.
 * @param input El texto de entrada del usuario.
 * @param p_buy La probabilidad de que el usuario realice una compra.
 * @param label La etiqueta de intención predicha por el modelo (BUY) (NOT_BUY).
 * @param threshold El umbral de decisión utilizado para determinar si la intención es válida o no
 */
public class IntentResponseDTOIN {
    private String input;
    private String p_buy;
    private String label;
    private String threshold;
    public IntentResponseDTOIN() {
    }   
}
