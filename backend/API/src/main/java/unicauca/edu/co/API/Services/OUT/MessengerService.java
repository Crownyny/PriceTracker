package unicauca.edu.co.API.Services.OUT;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
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
import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.ExceptionDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.Mapper.NormalizedProductMapper;
import unicauca.edu.co.API.Services.Events.NormalizedProductReceivedEvent;
import unicauca.edu.co.API.Services.Interfaces.OUT.IMessengerService;


/**
** Servicio de mensajería que escucha la cola de resultados de RabbitMQ y notifica a los usuarios por WebSocket.
** Se encarga de recibir los eventos normalizados desde la cola, procesarlos y enviar notificaciones a los usuarios correspondientes a través de WebSocket.
* Caso de uso 1: 
* 1. El servicio escucha la cola "normalized.events" de RabbitMQ.
* 2. Cuando recibe un mensaje, usa servicio de normalizacion para convertir el mensaje JSON en un objeto NormalizedProductDTO.
* 3. usa repositorio de producto para guardar el producto normalizado en la base de datos
* 4. Consulta el sessionID del usuario correspondiente al productRef del producto normalizado
* 5. Envía el producto normalizado al WebSocket privado del usuario utilizando el session
* Caso 2:
* 1. Logica de negocio alojada en el servicio productService ejecutada exitosamente
* 2. Servicio de product llama a sendToWebSocket para enviar el producto normalizado al usuario por WebSocket
*/

@Service
public class MessengerService implements IMessengerService {

    private static final Logger logger = LoggerFactory.getLogger(MessengerService.class);
    private final ApplicationEventPublisher eventPublisher;


    private final SimpMessagingTemplate messagingTemplate;
    private final NormalizedProductMapper mapper;
    private final WebSocketConfig webSocket;
    private final ObjectMapper objectMapper;

    public MessengerService(
        SimpMessagingTemplate messagingTemplate,
        NormalizedProductMapper mapper,
        WebSocketConfig webSocket,
        ObjectMapper objectMapper,
        ApplicationEventPublisher eventPublisher
    ) {
        this.messagingTemplate = messagingTemplate;
        this.mapper = mapper;
        this.webSocket = webSocket;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Escucha la cola de resultados de RabbitMQ y procesa los mensajes.
     * Cuando se recibe un mensaje, se convierte de JSON a un objeto NormalizedEventDTO
     * Si el evento contiene un producto normalizado, se publica un evento NormalizedProductReceivedEvent 
     * @param message el mensaje recibido de la cola como String JSON
     */
    @Override
    @RabbitListener(queues = "normalized.events", concurrency = "3-5")
    public void listenToResults(@Payload String message) {
        try {
            NormalizedEventDTO eventDTO = objectMapper.readValue(message, NormalizedEventDTO.class);
            if (eventDTO.getNormalizedProduct() != null) {
                eventPublisher.publishEvent(
                    new NormalizedProductReceivedEvent(
                        eventDTO.getNormalizedProduct()
                    )
                );
            }
        } catch (Exception e) {
            logger.error("Error al procesar el mensaje de la cola normalized.events", e);
        }
    }

    /**
     * Envía el producto normalizado al WebSocket privado del usuario.
     * Consulta en memoria el sessionID por medio de webSocketConfig 
     * @param productDTO Producto a enviar 
     */
    @Override
    public void sendToWebSocket(NormalizedProductDTO productDTO) {
        try {
            String sessionID = webSocket.getSession(productDTO.getProductRef());
            if (sessionID == null) {
                logger.warn("No se encontró sessionID para productRef: {}", productDTO.getProductRef());
                return;
            }
            SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
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

    @Override
    public void disconnectWebSocket(String sessionId, String productRef, ExceptionDTO errorMessage) {
        try {
            webSocket.removeSession(productRef, sessionId);
            messagingTemplate.convertAndSendToUser(
                sessionId,
                "/queue/errors",
                errorMessage
            );
            logger.info("WebSocket desconectado para sessionId: {}", sessionId);
        } catch (Exception e) {
            logger.error("Error al desconectar WebSocket", e);
        }
    }

    @Override
    public ExceptionDTO createExceptionDTO(QueryDTOIN query, String errorMessage, String update_at) {
        ExceptionDTO exceptionDTO = new ExceptionDTO();
        exceptionDTO.setProduct_ref(query.getProduct_ref());
        exceptionDTO.setMessage(errorMessage);
        exceptionDTO.setUpdate_at(update_at);
        return exceptionDTO;
    }

    /**
     * Maneja el evento NormalizedProductReceivedEvent publicado cuando se recibe un producto normalizado desde RabbitMQ.
     * @param event El evento que contiene el producto normalizado recibido.
     */
    @EventListener
    public void handleNormalizedProduct(
            NormalizedProductReceivedEvent event) {
        NormalizedProductDTO product = event.getProduct();
        sendToWebSocket(product);
    }

}