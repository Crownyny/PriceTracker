package unicauca.edu.co.API.Services.Events;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;


/**
 * Evento que representa la recepción de un producto normalizado. 
 * Este evento se utiliza para encapsular el producto normalizado recibido desde RabbitMQ y facilitar su procesamiento en otros componentes del sistema.
 */
public class NormalizedProductReceivedEvent {
    private final NormalizedProductDTO product;
    public NormalizedProductReceivedEvent(NormalizedProductDTO product) {this.product = product;}
    public NormalizedProductDTO getProduct() {return product;}
}