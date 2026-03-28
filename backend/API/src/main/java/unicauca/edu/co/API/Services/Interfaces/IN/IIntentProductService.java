package unicauca.edu.co.API.Services.Interfaces.IN;

import reactor.core.publisher.Mono;
import unicauca.edu.co.API.Presentation.DTO.ModelQueryDTO;
import unicauca.edu.co.API.Presentation.DTO.IN.IntentResponseDTOIN;

public interface IIntentProductService {

    /**
     * Obtiene la respuesta de intención para un título de consulta dado.
     * Preguntando al microservicio de modelo de intención.
     * @param queryTitle El título de la consulta para el cual se desea obtener la intención.
     * @return DTO de intencion clasificada por el microservicio de modelo de intención.
     */
    Mono<IntentResponseDTOIN> getIntentResponse(ModelQueryDTO query);

}
