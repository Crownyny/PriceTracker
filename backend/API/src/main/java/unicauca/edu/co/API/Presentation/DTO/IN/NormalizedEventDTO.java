package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * DTO para representar un evento de producto normalizado recibido de la cola.
 * Contiene información de control del mensaje y el producto normalizado.
 */

@Getter
@Setter
@AllArgsConstructor
public class NormalizedEventDTO {

    /**
     * @param jobId: Identificador único del proceso que normalizó el producto.
     * @param productRef: Referencia del producto consultado.
     * @param sourceName: Nombre de la fuente de donde se obtuvo el producto.
     * @param normalizedAt: Fecha y hora en que se normalizó el producto.
     * @param state: Estado del evento (ej: "normalized").
     * @param schemaVersion: Versión del esquema del mensaje.
     * @param errorMessage: Mensaje de error si ocurrió alguno.
     * @param searchId: Identificador de la búsqueda del producto.
     * @param normalizedProduct: Objeto que contiene toda la información del producto normalizado.
     */
     @JsonProperty("job_id")
    private String jobId;

    @JsonProperty("product_ref")
    private String productRef;

    @JsonProperty("source_name")
    private String sourceName;

    @JsonProperty("normalized_at")
    private String normalizedAt;

    private String state;

    @JsonProperty("schema_version")
    private String schemaVersion;

    @JsonProperty("error_message")
    private String errorMessage;

    @JsonProperty("search_id")
    private String searchId;

    @JsonProperty("normalized_product")
    private NormalizedProductDTO normalizedProduct;

    public NormalizedEventDTO() {
    }
}