package unicauca.edu.co.API.Services;

import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Config.WebSocketConfig;
import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Interfaces.IProductService;

@Service
public class ProductService implements IProductService {

    private static final Logger logger = LoggerFactory.getLogger(ProductService.class); 
    private final ScrapingService scrapingService;
    private final NormalizedService normalizedService;
    private final WebSocketConfig webSocket;


    public ProductService(
        ScrapingService scrapingService, 
        NormalizedService normalizedService,
        WebSocketConfig webSocket
    ) {
        this.scrapingService = scrapingService;
        this.normalizedService = normalizedService;
        this.webSocket = webSocket;

    }

    @Override
    public void searchProduct(QueryDTOIN query) {
        logger.info("Enviando query a la cola de scraping: {}", query);
        String var_productRef = createProductRef(query);
        query.setProduct_ref(var_productRef);
        query.setSearch_id(var_productRef);
        registerSession(query);
        scrapingService.sendData(query);
        logger.info("Query enviado exitosamente a la cola");
    }

    @Override
    public NormalizedProductDTO getProductById(String id) {
        // TODO Auto-generated method stub
        return null;
    }

    /**
     * Encargada de agregar la sesión WebSocket del usuario para el productRef generado
     * @param query query que llega del websocket
     */
    private void registerSession(QueryDTOIN query){
        webSocket.addSession(query.getProduct_ref(), query.getSessionId());
    }
    /**
     * Encargada de crear el productRef 
     * Toma el query, quita los espacios y agrega un numero aleatorio de 3 digitos 
     */
    private String createProductRef(QueryDTOIN query){
        String baseRef = query.getQuery().trim().replaceAll(" ", "");
        int randomSuffix = (int) (Math.random() * 900) + 100; // Número aleatorio de 3 dígitos
        return baseRef + "" + randomSuffix;
    }

}
