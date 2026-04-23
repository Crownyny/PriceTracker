package unicauca.edu.co.API.Domain.Validators.InterfacesValidators;

import unicauca.edu.co.API.Presentation.DTO.IN.AlertDTO;

public interface IAlertValidator {
    /** 
    * Establece el siguiente validador en la cadena de validación.
     * @param next El siguiente validador a ejecutar después de este validador.
     */
    void setNext(IAlertValidator next);
    /**
     * Valida la alerta. Si la validación es exitosa, se llama al siguiente validador en la cadena.
     *
     * @param request La alerta a validar.
     * @return {@code true} si la alerta pasa todas las validaciones de la cadena; {@code false} si se descarta.
     */
    boolean validate(AlertDTO request);

}
