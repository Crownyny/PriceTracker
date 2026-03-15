package unicauca.edu.co.API.Services.Interfaces;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;

public interface IMessengerService {
    /**
     * Escucha la cola de resultados de RabbitMQ y procesa los mensajes.
     * @param message el mensaje recibido de la cola como String JSON
     * 
     */
    void listenToResults(String message);
    /**
     * Consulta en memoria el sessionID por medio de webSocketConfig y envía el producto al cliente correspondiente
     * @param productDTO Producto a enviar normalizado a través del WebSocket privado del usuario.
     */
    public void sendToWebSocket(NormalizedProductDTO productDTO);
}
