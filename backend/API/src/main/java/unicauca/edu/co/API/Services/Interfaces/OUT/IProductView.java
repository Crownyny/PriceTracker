package unicauca.edu.co.API.Services.Interfaces.OUT;

import java.util.List;
import java.util.Optional;

import unicauca.edu.co.API.Presentation.DTO.OUT.ProductViewDTO;

/**
 * Encargada de guardar y mostrar las vistas de los productos, es decir, el historial de consultas realizadas por los usuarios.
 * Esta interfaz define los métodos necesarios para registrar cada consulta realizada por los usuarios, incluyendo detalles como
 */
public interface IProductView {

        /**
        * Registra una vista de producto en el historial de consultas.
        *
        * @param source_url La URL del producto que fue consultado por el usuario.
        */
        void registerProductView(String source_url);
    
        /**
        * Obtiene el historial de vistas de productos para un usuario específico.
        *
        * @param userId El ID del usuario cuyo historial se desea obtener.
        * @return Una lista de vistas de productos consultados por el usuario.
        */
        // List<ProductViewDTO> getProductViewsByUser(String userId);
        List<ProductViewDTO> getMostProductViews();
}
