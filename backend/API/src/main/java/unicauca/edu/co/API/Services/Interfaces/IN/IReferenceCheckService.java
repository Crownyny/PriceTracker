package unicauca.edu.co.API.Services.Interfaces.IN;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;

public interface IReferenceCheckService {
    /**
     * Verifica si una referencia de producto existe en la base de datos.
     * Caso 1: Si la referencia existe, devuelve trueee
     * Caso 2: Si la referencia no existe, devuelve false
     * @param productRef string  la referencia del producto a verificar.
     *
     */
    Boolean checkReferenceExists(String productRef);
}
