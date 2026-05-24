package unicauca.edu.co.API.Services.OUT;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import unicauca.edu.co.API.DataAccess.Entity.ProductViewEntity;
import unicauca.edu.co.API.DataAccess.Repository.ProductViewRepository;
import unicauca.edu.co.API.Presentation.DTO.OUT.ProductViewDTO;
import unicauca.edu.co.API.Services.Interfaces.OUT.IProductView;

@Service
public class ProductViewService implements IProductView {

    private final ProductViewRepository productViewRepository;

    public ProductViewService(
        ProductViewRepository productViewRepository) {
        this.productViewRepository = productViewRepository;
    }

    @Override
    public void registerProductView(String source_url) {
        ProductViewEntity productView = new ProductViewEntity();
        productView.setSourceUrl(source_url);
        productView.setViewedAt(java.time.LocalDateTime.now());
        productViewRepository.save(productView);
        System.out.println("Producto guardado en product view: " + source_url);
    }
    @Override
    public List<ProductViewDTO> getMostProductViews() {
    return productViewRepository
            .findTopViewedProducts(
                    LocalDateTime.now().minusDays(30),
                    PageRequest.of(0, 8)
            )
            .stream()
            .map(p -> {
                ProductViewDTO dto = new ProductViewDTO();
                dto.setSourceUrl(p.getSourceUrl());
                System.out.println("Producto con más vistas: " + p.getSourceUrl() + " con " + p.getViews() + " vistas");
                return dto;
            })
            .toList();
    }


}
