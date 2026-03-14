package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor

/**
 * DTO para representar una consulta de producto.
 * Se utiliza para transferir la información de la consulta de producto entre
 * la capa de presentación y la capa de aplicación.
 * @param sessionId: Identificador de la sesión WebSocket del usuario, para enviar resultados de forma privada.
 * @param query: Consulta de producto realizada por el usuario.
 * @param searchId: Identificador único de la búsqueda, para rastrear el progreso de la búsqueda y asociar resultados.
 * @param productRef: Referencia del producto a rastrear, para asociar resultados y rastrear el producto específico.
 * @param sources: Fuentes (tiendas) específicas a consultar, para limitar la búsqueda a ciertas fuentes.
 * @param priority: Prioridad de la consulta, para gestionar el orden de procesamiento de las consultas en la cola de scraping
 */
public class QueryDTOIN {
    private String sessionId; // Para identificar la conexión WebSocket del usuario
    private String query;
    private String search_id;
    private String product_ref;
    private String sources;
    public QueryDTOIN() {
    }
}
