package unicauca.edu.co.API.Services.IN;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import unicauca.edu.co.API.Config.WebSocketConfig;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.Domain.Model.ErrorType;
import unicauca.edu.co.API.Exception.BusinessException;
import unicauca.edu.co.API.Presentation.DTO.IN.FilterProductsParamsDTO;
import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.Mapper.NormalizedProductMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IProductService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IScrapingService;
import unicauca.edu.co.API.Services.OUT.MessengerService;
import unicauca.edu.co.API.Services.OUT.ProductViewService;


@Service
public class ProductService implements IProductService {

    private static final Logger logger = LoggerFactory.getLogger(ProductService.class); 
    private final IScrapingService scrapingService;
    private final ProductRepository productRepository;
    private final NormalizedProductMapper mapperProduct;
    private final ProductViewService productViewService;

    public ProductService(
        IScrapingService scrapingService,
        ProductRepository productRepository,
        WebSocketConfig webSocket, 
        MessengerService messengerService,
        NormalizedProductMapper mapperProduct,
        ReferenceCheckService referenceCheckService,
        ProductViewService productViewService
    ) {
        this.scrapingService = scrapingService;
        this.productRepository = productRepository;
        this.mapperProduct = mapperProduct;
        this.productViewService = productViewService;
    }

    @Override
    @Async
    public void searchProduct(QueryDTOIN query) {
        logger.info("Enviando query a la cola de scraping: {}", query);
        scrapingService.sendData(query);
        logger.info("Query enviado exitosamente a la cola");
    }

    @Override
    public List<NormalizedProductDTO> getProductByProductRef(
            QueryDTOIN query,
            FilterProductsParamsDTO filterParamsDTO
    ) {

        LocalDateTime twentyMinutesAgo =
                LocalDateTime.now().minusMinutes(20);
        validateFilters(filterParamsDTO);   
        Sort sort = createSort(
                filterParamsDTO.getSortBy(),
                filterParamsDTO.getOrder()
        );

        List<NormalizedProductEntity> entities =
                productRepository.searchProduct(
                        query.getProduct_ref(),
                        twentyMinutesAgo,
                        filterParamsDTO.getMinPrice(),
                        filterParamsDTO.getMaxPrice(),
                        filterParamsDTO.getSourceName(),
                        sort
                );

        return entities.stream()
                .map(mapperProduct::toDTO)
                .collect(Collectors.toList());
    }

    private void validateFilters(FilterProductsParamsDTO filter) {

    if (filter.getMinPrice() != null &&
        filter.getMinPrice() < 0) {

        throw new BusinessException(
            "minPrice no puede ser negativo",
            ErrorType.INVALID_PARAMETER
        );
    }

    if (filter.getMaxPrice() != null &&
        filter.getMaxPrice() < 0) {

        throw new BusinessException(
            "maxPrice no puede ser negativo",
            ErrorType.INVALID_PARAMETER
        );
    }

    if (filter.getMinPrice() != null &&
        filter.getMaxPrice() != null &&
        filter.getMinPrice() > filter.getMaxPrice()) {

        throw new BusinessException(
            "minPrice no puede ser mayor que maxPrice",
            ErrorType.INVALID_PARAMETER
        );
    }

    if (filter.getSortBy() != null &&
        !List.of(
            "canonicalName",
            "price",
            "updatedAt"
        ).contains(filter.getSortBy())) {

        throw new BusinessException(
            "sortBy inválido",
            ErrorType.INVALID_PARAMETER
        );
    }

    if (filter.getOrder() != null &&
        !List.of("asc", "desc")
                .contains(filter.getOrder().toLowerCase())) {

        throw new BusinessException(
            "order debe ser asc o desc",
            ErrorType.INVALID_PARAMETER
        );
    }
}
    @Override
    public QueryDTOIN createProductRef(QueryDTOIN query){
        String baseRef = query.getQuery().trim().replaceAll(" ", "").toLowerCase(Locale.ROOT);
        String var_productRef = baseRef;
        query.setProduct_ref(var_productRef);
        query.setSearch_id(var_productRef);
        return query;
    }

    @Override
    public NormalizedProductDTO getProductById(String id) {
        Optional<NormalizedProductEntity> entity = productRepository.findById(id);
        if (entity.isEmpty()) {
            return null;
        }
        productViewService.registerProductView(entity.get().getSourceUrl());
        logger.info("Producto guardado en product view", id, entity.get());
        return mapperProduct.toDTO(entity.get());
    }

    private Sort createSort(String sortBy, String order) {

        if (sortBy == null) {
            return Sort.by("updatedAt").descending();
        }

        Sort.Direction direction =
                "desc".equalsIgnoreCase(order)
                ? Sort.Direction.DESC
                : Sort.Direction.ASC;

        return Sort.by(direction, sortBy);
    }

    
    private NormalizedProductDTO getProductBySourceUrlMostRecent(String source_url) {
        NormalizedProductEntity entity = productRepository
                .findFirstBySourceUrlOrderByUpdatedAtDesc(source_url)
                .orElse(null);
        return mapperProduct.toDTO(entity);
    }

    @Override
    public List<NormalizedProductDTO> getProductMostSearch() {
        List<NormalizedProductDTO> mostViewedProducts = productViewService
                .getMostProductViews()
                .stream()
                .map(view -> getProductBySourceUrlMostRecent(view.getSourceUrl()))
                .filter(product -> product != null)
                .collect(Collectors.toList());
        return mostViewedProducts;
    }


}
