package unicauca.edu.co.API.Services.Interfaces.OUT;

import java.time.LocalDate;
import java.time.LocalDateTime;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.ExceptionDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.ProcessStatusDTO;

public interface IMessengerService {
    /**
     * Escucha la cola de resultados de RabbitMQ y procesa los mensajes.
     * @param message el mensaje recibido de la cola como String JSON
     * 
     */
    void listenToResults(String message);
    /**
     * Consulta en memoria el sessionID por medio de webSocketConfig y envía el producto al cliente correspondiente
     * @param payload Objeto a enviar  a través del WebSocket privado del usuario.
     * @param destination Destino al que se enviará el mensaje a través del WebSocket, por ejemplo, "/queue/products". 
     * @param productRef Referencia del producto, utilizada para obtener el sessionID del usuario correspondiente a ese producto. Este sessionID es necesario para enviar el mensaje al WebSocket privado del usuario correcto.
     */
    public <T> void sendToWebSocket(String productRef, String destination, T payload);

    /**
     * Desconecta el WebSocket del usuario correspondiente al sessionId.
     * @param sessionId El ID de sesión del usuario.
     */
    void disconnectWebSocket(String productRef, String sessionId, ExceptionDTO errorMessage);

    /**
     * Crea un objeto ExceptionDTO a partir de un QueryDTOIN y un mensaje de error. Este método se utiliza para encapsular la información de error relacionada con una consulta específica, permitiendo una comunicación clara y estructurada de los errores que puedan ocurrir durante el procesamiento de la consulta.
     * @param query     El objeto QueryDTOIN que contiene la información de la consulta relacionada con el error.
     * @param errorMessage El mensaje de error que describe la naturaleza del problema ocurrido durante el procesamiento de la consulta.
     * @param update_at La fecha y hora en que ocurrió el error, lo que puede ser útil para el seguimiento y la depuración de problemas.
     * @return Un objeto ExceptionDTO que encapsula la información del error, incluyendo detalles relevantes de la consulta y el mensaje de error proporcionado. Este DTO puede ser utilizado para comunicar errores de manera efectiva a través de la aplicación, facilitando la identificación y resolución de problemas.
     */
    ExceptionDTO createExceptionDTO(QueryDTOIN query, String errorMessage, LocalDateTime update_at);

    /**
     * Envía el estado del proceso a través del WebSocket al cliente correspondiente. 
     * @param status El estado del proceso a enviar.
     * @param productRef La referencia del producto asociado al estado del proceso.
     */
    void sendProcessStatus(ProcessStatusDTO status, String productRef);
}
