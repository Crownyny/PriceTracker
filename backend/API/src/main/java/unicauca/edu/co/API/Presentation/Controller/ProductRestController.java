package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import unicauca.edu.co.API.Services.IN.ProductService;

import java.util.List;


import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;

@RestController
@RequestMapping("/api/products")
public class ProductRestController {

    private final ProductService productService;

    public ProductRestController(
        ProductService productService
    ) {
        this.productService = productService;
    }
    @PostMapping("/search")
    public List<NormalizedProductDTO> searchProductQuery(@RequestBody QueryDTOIN query) {
        return productService.getProductByProductRef(query);
    }
}
