package unicauca.edu.co.API.Services.Interfaces.IN;

import java.util.List;

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
     * Obtiene un producto normalizado por su referencia. Si el producto existe en la base de datos, se devuelve el producto normalizado correspondiente. Si el producto no existe, se devuelve null.
     * @param query Objeto que contiene los criterios de búsqueda para los productos, incluyendo la referencia del producto.
     * @return Una lista de objetos NormalizedProductDTO que corresponden a la referencia del producto especificada. 
     */
    List<NormalizedProductDTO> getProductByProductRef(QueryDTOIN query);


    /**
     * Crea un productRef a partir del query recibido. El productRef se genera eliminando
     * los espacios del query y agregando un número aleatorio de 3 dígitos al final.
     * @param query Objeto que contiene los criterios de búsqueda para los productos, incluyendo el query original.
     * @return Un objeto QueryDTOIN que contiene el query original y el productRef generado.
     */
    QueryDTOIN createProductRef(QueryDTOIN query);
}
