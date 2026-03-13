package unicauca.edu.co.API.Services;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.Mapper.NormalizedProductMapper;
import unicauca.edu.co.API.Services.Interfaces.INormalizedService;

@Service
public class NormalizedService implements INormalizedService {

    private final RabbitTemplate rabbitTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final NormalizedProductMapper mapper;

    public NormalizedService(RabbitTemplate rabbitTemplate, SimpMessagingTemplate messagingTemplate,
        NormalizedProductMapper mapper) {
        this.rabbitTemplate = rabbitTemplate;
        this.messagingTemplate = messagingTemplate;
        this.mapper = mapper;
    }

    /**
     * Escucha la cola de resultados de RabbitMQ y procesa los mensajes.
     *
     * @param message el mensaje recibido de la cola
     */
    @Override
    @RabbitListener(queues = "scrapping.results")
    public NormalizedProductDTO listenToResults(@Payload NormalizedProductEntity message) {
        try {
            // Procesar el mensaje recibido
            NormalizedProductDTO productDTO = convertToDTO(message);

            // Enviar el producto normalizado al WebSocket privado del usuario
            String privateWebSocketQueue = "/queue/private-" + message.getId(); // TODO hablar con equipo para cambiar por sessionID
            messagingTemplate.convertAndSend(privateWebSocketQueue, productDTO);

            return productDTO;
        } catch (Exception e) {
            // Manejo de errores
            throw new RuntimeException("Error al procesar el mensaje y enviarlo al WebSocket privado", e);
        }
    }

    private NormalizedProductDTO convertToDTO(NormalizedProductEntity entity) {
            return mapper.toDTO(entity);
    }
}
