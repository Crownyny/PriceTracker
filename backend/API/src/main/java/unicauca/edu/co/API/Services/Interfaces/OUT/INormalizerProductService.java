package unicauca.edu.co.API.Services.Interfaces.OUT;



import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Events.NormalizedProductReceivedEvent;

public interface INormalizerProductService {

    /**
     * Maneja el evento NormalizedProductReceivedEvent publicado cuando se recibe un producto normalizado desde RabbitMQ.
     * @param event El evento que contiene el producto normalizado recibido.
     */
    void handleNormalizedProduct(NormalizedProductReceivedEvent event);
    /**
     * Envía un producto normalizado al WebSocket privado del usuario correspondiente utilizando el sessionID.
     * @param product El producto normalizado que se enviará al WebSocket del usuario. El método consulta el sessionID del usuario correspondiente al productRef del producto normalizado y envía el producto al WebSocket privado del usuario utilizando ese sessionID.
     */
    void sendNormalizedProductToWebSocket(NormalizedProductDTO product);
}
