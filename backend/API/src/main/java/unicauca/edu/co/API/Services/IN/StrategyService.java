package unicauca.edu.co.API.Services.IN;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import unicauca.edu.co.API.Config.WebSocketConfig;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.ExceptionDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IStrategyServices;
import unicauca.edu.co.API.Services.OUT.MessengerService;

@Service
public class StrategyService implements IStrategyServices{

    private static final Logger logger = LoggerFactory.getLogger(StrategyService.class);
    private final ReferenceCheckService referenceCheckService;
    private final ProductService productService;
    private final ProductRepository productRepository;
    private final MessengerService messengerService;
    private final WebSocketConfig webSocket;

    public StrategyService(
        ReferenceCheckService referenceCheckService,
        ProductService productService,
        ProductRepository productRepository,
        MessengerService messengerService,
        WebSocketConfig webSocket
    ) {
        this.referenceCheckService = referenceCheckService;
        this.productService = productService;
        this.productRepository = productRepository;
        this.messengerService = messengerService;
        this.webSocket = webSocket;
    }
    @Override
    public void resolveSearchStrategy(QueryDTOIN query) {
        query = productService.createProductRef(query);
        registerSession(query);
        String var_productRef = DecryptProductRef(query.getProduct_ref());
        if(referenceCheckService.checkReferenceExists(var_productRef)) {
            logger.info(var_productRef + " ya existe en la base de datos, enviando producto existente al usuario");
            resolveStrategyAPI(query, var_productRef);
        } else {
            referenceCheckService.save(var_productRef);
            resolveStrategyWebScraping(query, var_productRef);
        }
    }
    @Override
    public void resolveStrategyWebScraping(QueryDTOIN query, String var_productRef) {
        logger.info("Iniciando estrategia de web scraping para productRef: {}", var_productRef);
        productService.searchProduct(query);
    }

    @Override
    public void resolveStrategyAPI(QueryDTOIN query, String var_productRef) {
        NormalizedProductEntity entity = productRepository.findByProductRefStartingWith(var_productRef).get(0);
        ExceptionDTO error= messengerService.createExceptionDTO(query, var_productRef, entity.getUpdatedAt());
        messengerService.disconnectWebSocket(query.getSessionId(), var_productRef, error);
    }

    private String DecryptProductRef(String productRef) {
        String baseRef = productRef.substring(0, productRef.length() - 3);
        return baseRef;
    }
    
    /**
     * Encargada de agregar la sesión WebSocket del usuario para el productRef generado
     * @param query query que llega del websocket
     */
    private void registerSession(QueryDTOIN query){
        webSocket.addSession(query.getProduct_ref(), query.getSessionId());
    }
    
}