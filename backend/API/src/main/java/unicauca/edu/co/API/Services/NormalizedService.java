package unicauca.edu.co.API.Services;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import unicauca.edu.co.API.Config.WebSocketConfig;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.Mapper.NormalizedProductMapper;
import unicauca.edu.co.API.Services.Interfaces.INormalizedService;

@Service
public class NormalizedService implements INormalizedService {

    private final RabbitTemplate rabbitTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final NormalizedProductMapper mapper;
    private final WebSocketConfig webSocket;

    public NormalizedService(
        RabbitTemplate rabbitTemplate, 
        SimpMessagingTemplate messagingTemplate,
        NormalizedProductMapper mapper,
        WebSocketConfig webSocket
    ) {
        this.rabbitTemplate = rabbitTemplate;
        this.messagingTemplate = messagingTemplate;
        this.mapper = mapper;
        this.webSocket = webSocket; 
    }

    /**
     * Escucha la cola de resultados de RabbitMQ y procesa los mensajes.
     *
     * @param message el mensaje recibido de la cola
     */
    @Override
    @RabbitListener(queues = "normalized.events")
    public NormalizedProductDTO listenToResults(@Payload NormalizedProductEntity message) {
        try {
            // Procesar el mensaje recibido
            NormalizedProductDTO productDTO = convertToDTO(message);
            System.out.println("Producto procesado y enviado al WebSocket privado: " + productDTO);
            sendToWebSocket(productDTO);
            return productDTO;
        } catch (Exception e) {
            throw new RuntimeException("Error al procesar el mensaje y enviarlo al WebSocket privado", e);
        }
    }
    /**
     * Envía el producto normalizado al WebSocket privado del usuario.
     * Consutla en memoria el sessionID por medio de webSocketConfig 
     * @param productDTO Producto a enviar 
     */
    private void sendToWebSocket(NormalizedProductDTO productDTO) {
        String sessionID = webSocket.getSession(productDTO.getProductRef()); 
        String privateWebSocketQueue = "/queue/private-" + sessionID;
        messagingTemplate.convertAndSend(privateWebSocketQueue, productDTO);
        System.out.println("Producto enviado al WebSocket privado: " + productDTO);
    }

    
    private NormalizedProductDTO convertToDTO(NormalizedProductEntity entity) {
            return mapper.toDTO(entity);
    }
}
