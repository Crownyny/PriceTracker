package unicauca.edu.co.API.Services.Validators.ValidatorImpl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Validators.InterfacesValidators.AbstractProductValidator;

/**
 * Validador de precio y moneda 
 * Descarta productos con precio inválido (<=0) o moneda no ISO 4217 (3 caracteres).
 */
public class LogicalPriceValidator extends AbstractProductValidator {

    private static final Logger logger = LoggerFactory.getLogger(LogicalPriceValidator.class);

    @Override
    public void validate(NormalizedProductDTO request) {
        if (request == null) {
            return;
        }
        if (request.getPrice() == null || request.getPrice() <= 0) {
            logger.debug("Producto descartado por precio inválido: productRef={}", request.getProductRef());
            return;
        }
        if (request.getCurrency() == null || request.getCurrency().length() != 3) {
            logger.debug("Producto descartado por moneda inválida (debe ser ISO 4217): productRef={}", request.getProductRef());
            return;
        }
        next(request);
    }
}
