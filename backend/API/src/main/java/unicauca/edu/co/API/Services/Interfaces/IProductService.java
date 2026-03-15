package unicauca.edu.co.API.Services.Interfaces;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
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

}
