package unicauca.edu.co.API.Services.Events;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormlaizedProductEventDTO;

/**
 * Evento que representa la finalización de la búsqueda normalizada.
 * Se publica cuando el Normalizer ha completado el procesamiento de todos los jobs 
 * asociados a un SearchRequest.
 */
public class NormlaizedProductFinalizedEvent {

    private NormlaizedProductEventDTO productReceivedEvent;
    public NormlaizedProductFinalizedEvent(NormlaizedProductEventDTO productReceivedEvent) {this.productReceivedEvent = productReceivedEvent;}
    public NormlaizedProductEventDTO  getNormalizedProductEventDTO() {return productReceivedEvent;}
}
