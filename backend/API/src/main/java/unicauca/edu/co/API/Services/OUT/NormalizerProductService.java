package unicauca.edu.co.API.Services.OUT;

import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Config.WebSocketConfig;
import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.IProductValidator;
import unicauca.edu.co.API.Presentation.DTO.Enum.ProcessStatus;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormlaizedProductEventDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.ProcessStatusDTO;
import unicauca.edu.co.API.Services.Events.NormalizedProductReceivedEvent;
import unicauca.edu.co.API.Services.Events.NormlaizedProductFinalizedEvent;
import unicauca.edu.co.API.Services.Interfaces.OUT.IMessengerService;
import unicauca.edu.co.API.Services.Interfaces.OUT.INormalizerProductService;

/**
 * Servicio que maneja la lógica de negocio relacionada con productos normalizados.
 * Escucha 
 * EVENTOS
 *  - productos normalizados recibidos y
 *  - Servicio de normalizacion finalizado  
 * FUNCIONES:
 *  - valida los productos por medio de una cadena de validadores
 *  - Envía  los productos a través del WebSocket si pasan la validación.
 */
@Service
public class NormalizerProductService implements INormalizerProductService {
    private final String WEBSOCKET_PRODUCTS = "/queue/products";
    private final IMessengerService messengerService;
    private final IProductValidator productValidationChain;
    private final WebSocketConfig webSocketConfig;
    private static final Logger logger = LoggerFactory.getLogger(MessengerService.class);


    public NormalizerProductService(
        IMessengerService messengerService,
        IProductValidator productValidationChain,
        WebSocketConfig webSocketConfig
    ) {
        this.messengerService = messengerService;
        this.productValidationChain = productValidationChain;
        this.webSocketConfig = webSocketConfig;
    }

    @Async
    @EventListener
    public void handleNormalizedProduct(NormalizedProductReceivedEvent event) {
        NormalizedProductDTO product = event.getProduct();
        logger.info(
            "Recibido producto normalizado para validar/enviar: productRef={}, canonicalName={}, price={}, currency={}",
            product != null ? product.getProductRef() : null,
            product != null ? product.getCanonicalName() : null,
            product != null ? product.getPrice() : null,
            product != null ? product.getCurrency() : null,
            product != null ? product.getId() : null
        );
        if (product == null) {
            return;
        }
        if (productValidationChain.validate(product)) {
            logger.info("Producto pasó validadores; enviando al WebSocket: productRef={} canonicalName={}",
                product.getProductRef(), product.getCanonicalName());
            sendNormalizedProductToWebSocket(product);
        }
        
    }

    @Async
    @EventListener
    public void handleNormalizedProductFinalized(NormlaizedProductFinalizedEvent event) {
        NormlaizedProductEventDTO productReceivedEventDTO = event.getNormalizedProductEventDTO();
        ProcessStatusDTO status = new ProcessStatusDTO(ProcessStatus.FINISHED);
        System.out.println("Enviando estado de proceso FINISHED para productRef: " + productReceivedEventDTO.getProductRef());
        messengerService.sendProcessStatus(status, productReceivedEventDTO.getProductRef());

        String sessionId = webSocketConfig.getSession(productReceivedEventDTO.getProductRef());
        if (sessionId != null) {
            webSocketConfig.removeSession(productReceivedEventDTO.getProductRef(), sessionId);
            logger.info(
                "Sesión WebSocket cerrada al finalizar normalización. productRef={}, sessionId={}",
                productReceivedEventDTO.getProductRef(),
                sessionId
            );
        }
    }

     @Override
     @Async
     public void sendNormalizedProductToWebSocket(NormalizedProductDTO product) {
        ProcessStatusDTO status = new ProcessStatusDTO(ProcessStatus.NORMALIZING);
        System.out.println("Enviando estado de proceso NORMALIZING para productRef: " + product.getProductRef());
        messengerService.sendProcessStatus(status, product.getProductRef());
        messengerService.sendToWebSocket(product.getProductRef(), WEBSOCKET_PRODUCTS, product);
     }
    

}
