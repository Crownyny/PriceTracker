package unicauca.edu.co.API.Services.Interfaces;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;

public interface IProductService {
    /**
     * Busca productos según los criterios especificados en el QueryDTOIN. 
     * Maneja caso A: Si el producto ya existe en la base de datos, se devuelve el producto existente.
     * Maneja caso B: Si el producto no existe, se realiza el scrapping 
     * @param query Objeto que contiene los criterios de búsqueda para los productos.
     * @return 
     */
    public void searchProduct(QueryDTOIN query);
    /**
     * Obtiene un producto por su ID.
     * @param id El ID del producto a buscar.
     * @return Un NormalizedProductDTO que representa el producto encontrado, o null si no se encuentra ningún producto con el ID especificado.
     */
    public NormalizedProductDTO getProductById(String id);
    
}
