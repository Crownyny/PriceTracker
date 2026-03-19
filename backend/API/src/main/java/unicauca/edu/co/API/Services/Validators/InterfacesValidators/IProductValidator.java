package unicauca.edu.co.API.Services.Validators.InterfacesValidators;


import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
/**
 * Interfaz para los validadores de productos.
 * Define los métodos que deben implementar los validadores de productos.
 * 
 */
public interface IProductValidator {
    /**
     * Establece el siguiente validador en la cadena de validación.
     * @param next El siguiente validador a ejecutar después de este validador.
     */
    void setNext(IProductValidator next);
    /**
     * Valida el producto normalizado. Si la validación es exitosa, se llama al siguiente validador en la cadena.
     * @param request El producto normalizado a validar.
     */
    void validate(NormalizedProductDTO request);
}
