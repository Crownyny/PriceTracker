package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Services.ProductService;

@Controller
public class ProductController {

    private static final Logger logger = LoggerFactory.getLogger(ProductController.class);
    private final ProductService productService;
    private final SimpMessagingTemplate messagingTemplate;

    public ProductController(ProductService productService, SimpMessagingTemplate messagingTemplate) {
        this.productService = productService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Maneja las solicitudes de búsqueda enviadas por WebSocket.
     *
     * @param query QueryDTOIN con los detalles de la búsqueda
     * @throws Exception si ocurre un error durante la búsqueda
     */
    @MessageMapping("/search")
    @SendTo("/topic/search-results")
    public void searchProduct(QueryDTOIN query) throws Exception {
        logger.info("Recibida solicitud de búsqueda: {}", query);

        // Enviar la búsqueda al servicio
        productService.SearchProduct(query);

        // Simular respuesta asíncrona (en producción, esto vendría de RabbitMQ)
        messagingTemplate.convertAndSend("/topic/search-results", "Búsqueda en proceso para: " + query.getQuery());
    }

    /**
     * Envía resultados específicos a una cola privada del usuario.
     *
     * @param userId ID del usuario
     * @param result Resultado de la búsqueda
     */
    public void sendPrivateResult(String userId, Object result) {
        String destination = "/queue/private-" + userId;
        logger.info("Enviando resultado privado a {}: {}", destination, result);
        messagingTemplate.convertAndSend(destination, result);
    }
}
