package unicauca.edu.co.API.Services.Validators.ValidatorImpl;

import java.util.Currency;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Validators.InterfacesValidators.AbstractProductValidator;

public class LogicalPriceValidator extends AbstractProductValidator {

    private static final Logger logger = LoggerFactory.getLogger(LogicalPriceValidator.class);

    @Override
    public void validate(NormalizedProductDTO request) {
        if (request == null) {
            return;
        }

        Double price = request.getPrice();
        if (price == null || price <= 0) {
            logger.info(
                "Producto descartado por precio inválido: productRef={}, canonicalName={}, price={}",
                request.getProductRef(), request.getCanonicalName(), price
            );
            return;
        }

        String currency = request.getCurrency();
        if (currency == null || currency.isBlank()) {
            logger.info(
                "Producto descartado por moneda vacía: productRef={}, canonicalName={}",
                request.getProductRef(), request.getCanonicalName()
            );
            return;
        }

        String normalizedCurrency = currency.trim().toUpperCase(java.util.Locale.ROOT);
        try {
            Currency.getInstance(normalizedCurrency); // valida que sea un ISO 4217 válido
        } catch (IllegalArgumentException ex) {
            logger.info(
                "Producto descartado por moneda no-ISO4217: productRef={}, canonicalName={}, currency={}",
                request.getProductRef(), request.getCanonicalName(), currency
            );
            return;
        }

        next(request);
    }

}
