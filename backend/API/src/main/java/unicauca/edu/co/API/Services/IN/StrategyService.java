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
        if(referenceCheckService.checkReferenceExists(query.getProduct_ref())) {
            logger.info(query.getProduct_ref() + " ya existe en la base de datos, enviando producto existente al usuario");
            resolveStrategyAPI(query, query.getProduct_ref());
        } else {
            referenceCheckService.save(query.getProduct_ref());
            resolveStrategyWebScraping(query, query.getProduct_ref());
        }
    }
    @Override
    public void resolveStrategyWebScraping(QueryDTOIN query, String var_productRef) {
        logger.info("Iniciando estrategia de web scraping para productRef: {}", var_productRef);
        referenceCheckService.save(query.getProduct_ref());
        productService.searchProduct(query);
    }

    @Override
    public void resolveStrategyAPI(QueryDTOIN query, String var_productRef) {
        var matches = productRepository.findByProductRefStartingWith(var_productRef);
        if (matches == null || matches.isEmpty()) {
            logger.warn(
                "No se encontraron productos para productRef={} en ruta de cache. Reintentando scraping.",
                var_productRef
            );
            resolveStrategyWebScraping(query, var_productRef);
            return;
        }

        NormalizedProductEntity entity = matches.get(0);

        System.out.println("Producto encontrado en base de datos: " + entity.getProductRef());
        ExceptionDTO error= messengerService.createExceptionDTO(query, "PRODUCT_IN_BD", entity.getUpdatedAt());
        messengerService.sendToWebSocket(query.getProduct_ref(), "/queue/errors", error);
    }

    
    
    /**
     * Encargada de agregar la sesión WebSocket del usuario para el productRef generado
     * @param query query que llega del websocket
     */
    private void registerSession(QueryDTOIN query){
        webSocket.addSession(query.getProduct_ref(), query.getSessionId(), query.getQuery());
    }
    
}