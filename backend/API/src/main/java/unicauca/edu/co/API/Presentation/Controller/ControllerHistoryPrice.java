package unicauca.edu.co.API.Presentation.Controller;


import org.springframework.security.access.prepost.PreAuthorize;

import unicauca.edu.co.API.Presentation.DTO.IN.ProductPriceHistoryDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IPriceHistoryService;
import unicauca.edu.co.API.Services.enums.Range;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controlador para manejar las solicitudes relacionadas con el historial de precios de los productos.
 * Proporciona una API REST para obtener el historial de precios de un producto específico.
 */

@RestController
@RequestMapping("/api/v1/products/")
public class ControllerHistoryPrice {

    private final IPriceHistoryService historyPriceService;

    public ControllerHistoryPrice( IPriceHistoryService historyPriceService) {this.historyPriceService = historyPriceService;}

    @GetMapping("{productId}/priceHistory")
    @PreAuthorize("isAuthenticated()")
    public ProductPriceHistoryDTO getHistoryPrice(@PathVariable String productId, @RequestParam Range range) {
        return historyPriceService.getHistoryPrice(productId, range);
    }
}
