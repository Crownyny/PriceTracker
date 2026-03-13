package unicauca.edu.co.API.Services;

import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Interfaces.IProductService;

@Service
public class ProductService implements IProductService {

    private static final Logger logger = LoggerFactory.getLogger(ProductService.class); 
    private final ScrapingService scrapingService;
    public ProductService(ScrapingService scrapingService) {
        this.scrapingService = scrapingService;
    }

    @Override
    public void SearchProduct(QueryDTOIN query) {
        logger.info("Enviando query a la cola de scraping: {}", query);
        scrapingService.sendData(query);
        logger.info("Query enviado exitosamente a la cola");

        // Escuchar la cola de resultados de RabbitMQ
        logger.info("Esperando resultados de la cola 'scrapping.results'...");
        // La lógica de escucha está implementada en ScrapingService
    }

    @Override
    public NormalizedProductDTO getProductById(String id) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public NormalizedProductDTO createProduct(NormalizedProductDTO product) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public NormalizedProductDTO updateProduct(String id, NormalizedProductDTO product) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public void deleteProduct(String id) {
        // TODO Auto-generated method stub
        
    }

    @Override
    public NormalizedProductDTO[] getAllProducts() {
        // TODO Auto-generated method stub
        return null;
    }
    
}
