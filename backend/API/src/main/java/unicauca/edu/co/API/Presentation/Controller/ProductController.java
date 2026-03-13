package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.messaging.handler.annotation.Header;
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
     * @param sessionId ID de la sesión WebSocket para identificar al usuario
     */

    @MessageMapping("/search")
    public void searchProduct(QueryDTOIN query,
                              @Header("simpSessionId") String sessionId) {
        query.setSessionId(sessionId);
        productService.SearchProduct(query);
    }

}
