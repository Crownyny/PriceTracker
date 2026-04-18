package unicauca.edu.co.API.Presentation.Controller;


import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Services.Interfaces.IN.IStrategyServices;




@Controller
public class ProductWebSocketController {

    
    private static final Logger logger = LoggerFactory.getLogger(ProductWebSocketController.class);
    private final SimpMessagingTemplate messagingTemplate;
    private final IStrategyServices strategyService;

    public ProductWebSocketController(
        SimpMessagingTemplate messagingTemplate,
        IStrategyServices strategyService
    ) {

        this.messagingTemplate = messagingTemplate;
        this.strategyService = strategyService;
    }

    /**
     * Maneja las solicitudes de búsqueda enviadas por WebSocket.
     *
     * @param query QueryDTOIN con los detalles de la búsqueda
     * @param sessionId ID de la sesión WebSocket para identificar al usuario
     */
    @MessageMapping("/search")
    public void searchProduct(QueryDTOIN query, @Header("simpSessionId") String sessionId) {
        query.setSessionId(sessionId);
        try {
            strategyService.resolveSearchStrategy(query);
        } catch (Exception e) {
            logger.error("Error al resolver la estrategia para el producto: ", e);
        }
    }
    
    @GetMapping("/test-ws")
    @ResponseBody
        public String testWs() {
        messagingTemplate.convertAndSend("/topic/test", "hola websocket");
        return "ok";
    }

}