package unicauca.edu.co.API.Services;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Config.WebSocketConfig;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.Presentation.DTO.IN.NormalizedEventDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.Mapper.NormalizedProductMapper;
import unicauca.edu.co.API.Services.Interfaces.INormalizedService;

@Service
public class NormalizedService implements INormalizedService {

    private static final Logger logger = LoggerFactory.getLogger(NormalizedService.class);
    
    private final RabbitTemplate rabbitTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final NormalizedProductMapper mapper;
    private final WebSocketConfig webSocket;
    private final ObjectMapper objectMapper;

    public NormalizedService(
        RabbitTemplate rabbitTemplate, 
        SimpMessagingTemplate messagingTemplate,
        NormalizedProductMapper mapper,
        WebSocketConfig webSocket,
        ObjectMapper objectMapper
    ) {
        this.rabbitTemplate = rabbitTemplate;
        this.messagingTemplate = messagingTemplate;
        this.mapper = mapper;
        this.webSocket = webSocket;
        this.objectMapper = objectMapper;
    }

    /**
     * Escucha la cola de resultados de RabbitMQ y procesa los mensajes.
     *
     * @param message el mensaje recibido de la cola como String JSON
     */
    @Override
    @RabbitListener(queues = "normalized.events")
    public void listenToResults(@Payload String message) {
        try {
            logger.info("Mensaje recibido de la cola normalized.events: {}", message);
            
            // Deserializar el JSON string a NormalizedProductEntity
            NormalizedEventDTO eventDTO = objectMapper.readValue(message, NormalizedEventDTO.class);
            logger.info("EVENTO___________________________________--", eventDTO);
            NormalizedProductEntity productEntity = null;
            NormalizedProductDTO productDTO = null;
           //Extraer de eventDTO el producto normalizado y convertirlo a NormalizedProductEntity
            if (eventDTO.getNormalizedProduct() != null) {
                productDTO = eventDTO.getNormalizedProduct();
                productEntity = mapper.toEntity(productDTO);

                //TODO guardar en base de datos
                logger.info("Producto normalizado convertido a entidad: {}", productEntity);
            } else {
                logger.warn("El mensaje no contiene un producto normalizado válido: {}", message);
                
            }
            sendToWebSocket(productDTO);

            // No se devuelve nada ya que el resultado se envía al WebSocket privado

        } catch (Exception e) {
            logger.error("Error al procesar el mensaje de la cola normalized.events", e);
          
        }
    }

    /**
     * Envía el producto normalizado al WebSocket privado del usuario.
     * Consulta en memoria el sessionID por medio de webSocketConfig 
     * @param productDTO Producto a enviar 
     */
    private void sendToWebSocket(NormalizedProductDTO productDTO) {
        try {
            String sessionID = webSocket.getSession(productDTO.getProductRef());

            if (sessionID == null) {
                logger.warn("No se encontró sessionID para productRef: {}", productDTO.getProductRef());
                return;
            }

            SimpMessageHeaderAccessor headerAccessor =
                SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);

            headerAccessor.setSessionId(sessionID);
            headerAccessor.setLeaveMutable(true);

            messagingTemplate.convertAndSendToUser(
                sessionID,
                "/queue/products",
                productDTO,
                headerAccessor.getMessageHeaders()
            );
            logger.info("Producto enviado al usuario {} a /queue/products: {}", sessionID, productDTO);

        } catch (Exception e) {
            logger.error("Error al enviar producto al WebSocket", e);
        }
    }

}