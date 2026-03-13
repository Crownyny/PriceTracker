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
    public void SearchProduct(QueryDTOIN query);
    /**
     * Obtiene un producto por su ID.
     * @param id El ID del producto a buscar.
     * @return Un NormalizedProductDTO que representa el producto encontrado, o null si no se encuentra ningún producto con el ID especificado.
     */
    public NormalizedProductDTO getProductById(String id);
    /**
     * Crea un nuevo producto en la base de datos.
     * @param product Un NormalizedProductDTO que contiene los datos del producto a crear.
     * @return Un NormalizedProductDTO que representa el producto creado
     */
    public NormalizedProductDTO createProduct(NormalizedProductDTO product);

    /**
     * Actualiza un producto existente en la base de datos.
     * @param id El ID del producto a actualizar.
     * @param product   
     * @return
     */
    public NormalizedProductDTO updateProduct(String id, NormalizedProductDTO product);
    
    /**
     * Elimina un producto de la base de datos por su ID.
     * @param id El ID del producto a eliminar.
     */
    public void deleteProduct(String id);

    /**
     * Obtiene todos los productos almacenados en la base de datos.
     * @return
     */
    public NormalizedProductDTO[] getAllProducts();
}
