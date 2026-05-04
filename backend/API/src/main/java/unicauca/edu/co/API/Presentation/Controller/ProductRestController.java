package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import unicauca.edu.co.API.Services.IN.ProductService;
import unicauca.edu.co.API.Services.Interfaces.OUT.INormalizerProductService;

import java.util.List;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import org.springframework.web.bind.annotation.GetMapping;


@RestController
@RequestMapping("/api/products")
public class ProductRestController {

	private final ProductService productService;
	private final INormalizerProductService normalizerProductService;

	public ProductRestController(
		ProductService productService,
		INormalizerProductService normalizerProductService
	) {
		this.productService = productService;
		this.normalizerProductService = normalizerProductService;
	}

	@PostMapping("/search")
	public List<NormalizedProductDTO> searchProductQuery(@RequestBody QueryDTOIN query) {
		return productService.getProductByProductRef(query);
	}

	/**
	 * Obtiene un producto normalizado por su ID.
	 * 
	 * @param productId El ID del producto a obtener
	 * @return ResponseEntity con el NormalizedProductDTO si existe, o 404 si no se encuentra
	 */
	@GetMapping("/{productId}/product")
	public ResponseEntity<NormalizedProductDTO> getProductById(@PathVariable String productId) {
		NormalizedProductDTO product = normalizerProductService.getNormalizedProductById(productId);
		
		if (product == null) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}
		
		return ResponseEntity.ok(product);
	}

}
