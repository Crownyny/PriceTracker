package unicauca.edu.co.API.Services.IN;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;


import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Config.WebSocketConfig;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.Mapper.NormalizedProductMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IProductService;
import unicauca.edu.co.API.Services.OUT.MessengerService;
import unicauca.edu.co.API.Services.OUT.ScrapingService;


@Service
public class ProductService implements IProductService {

    private static final Logger logger = LoggerFactory.getLogger(ProductService.class); 
    private final ScrapingService scrapingService;
    private final ProductRepository productRepository;
    private final NormalizedProductMapper mapperProduct;

    public ProductService(
        ScrapingService scrapingService, 
        ProductRepository productRepository,
        WebSocketConfig webSocket, 
        MessengerService messengerService,
        NormalizedProductMapper mapperProduct,
        ReferenceCheckService referenceCheckService
    ) {
        this.scrapingService = scrapingService;
        this.productRepository = productRepository;
        this.mapperProduct = mapperProduct;
    }

    @Override
    @Async
    public void searchProduct(QueryDTOIN query) {
        logger.info("Enviando query a la cola de scraping: {}", query);
        scrapingService.sendData(query);
        logger.info("Query enviado exitosamente a la cola");
    }

    @Override
    public List<NormalizedProductDTO> getProductByProductRef(QueryDTOIN query) {
        List<NormalizedProductDTO> products = null;
        List<NormalizedProductEntity> entities = productRepository.findByProductRef(query.getProduct_ref());
        if(entities != null && !entities.isEmpty()) {
            products = entities.stream()
                .map(entity -> mapperProduct.toDTO(entity))
                .collect(Collectors.toList());
        }
        return products;
    }

    @Override
    public QueryDTOIN createProductRef(QueryDTOIN query){
        String baseRef = query.getQuery().trim().replaceAll(" ", "");
        int randomSuffix = (int) (Math.random() * 900) + 100; // Número aleatorio de 3 dígitos
        String var_productRef = baseRef + "" + randomSuffix;
        query.setProduct_ref(var_productRef);
        query.setSearch_id(var_productRef);
        return query;
    }


}
