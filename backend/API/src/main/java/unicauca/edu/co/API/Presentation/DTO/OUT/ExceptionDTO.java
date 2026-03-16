package unicauca.edu.co.API.Presentation.DTO.OUT;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

/**
 * DTO para representar una excepción que ocurrió durante el procesamiento de una solicitud. 
 * Este DTO se utiliza para encapsular la información relevante
 * message: El mensaje de error que describe la excepción.
 * product_ref: La referencia del producto relacionada con la excepción.
 * update_at: La fecha y hora de la consulta del producto.
 */

@Getter
@Setter
@AllArgsConstructor
public class ExceptionDTO {
    private String message;
    private String product_ref;
    private String update_at;
    public ExceptionDTO(){}
}
