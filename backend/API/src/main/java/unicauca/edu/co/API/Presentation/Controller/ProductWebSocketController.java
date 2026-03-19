package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.boot.autoconfigure.web.WebProperties.Resources.Chain.Strategy;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Services.IN.ProductService;
import unicauca.edu.co.API.Services.IN.StrategyService;
import org.springframework.web.bind.annotation.RequestParam;


@Controller
public class ProductWebSocketController {

    private static final Logger logger = LoggerFactory.getLogger(ProductWebSocketController.class);
    private final StrategyService strategyService;
    private final SimpMessagingTemplate messagingTemplate;

    public ProductWebSocketController(
        ProductService productService,
        StrategyService strategyService, 
        SimpMessagingTemplate messagingTemplate
    ) {
        this.strategyService = strategyService; 
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
        strategyService.resolveSearchStrategy(query);
    }
    
    @GetMapping("/test-ws")
    @ResponseBody
        public String testWs() {
        messagingTemplate.convertAndSend("/topic/test", "hola websocket");
        return "ok";
    }

}