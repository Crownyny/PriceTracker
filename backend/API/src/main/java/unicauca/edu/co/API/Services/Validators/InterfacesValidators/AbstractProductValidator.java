package unicauca.edu.co.API.Services.Validators.InterfacesValidators;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;

/**
 * Validador abstracto para productos que implementa la interfaz IProductValidator.
 * Proporciona una implementación base para la cadena de validadores de productos
 */
public abstract class AbstractProductValidator implements IProductValidator {
    private IProductValidator next;
    @Override
    public void setNext(IProductValidator next) {
        this.next = next;
    }
    protected void next(NormalizedProductDTO request) {
        if(next != null) {
            next.validate(request);
        }
    }
}