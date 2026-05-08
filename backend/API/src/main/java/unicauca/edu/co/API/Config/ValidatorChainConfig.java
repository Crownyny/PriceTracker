package unicauca.edu.co.API.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.IProductValidator;
import unicauca.edu.co.API.Domain.Validators.ValidatorImpl.AccessoryAndVariantExclusionValidator;
import unicauca.edu.co.API.Domain.Validators.ValidatorImpl.LogicalPriceValidator;
import unicauca.edu.co.API.Domain.Validators.ValidatorImpl.SimilarityThresholdValidator;

/**
 * Configura la cadena de responsabilidad de validadores (HU-1 a HU-7).
 * Orden: precio lógico → exclusión accesorios/variantes → umbral de similitud.
 * El envío al WebSocket no forma parte de la cadena; lo hace {@code MessengerService} si {@code validate} devuelve true.
 */
@Configuration
public class ValidatorChainConfig {

    @Value("${app.validation.similarity-threshold:0.70}")
    private double similarityThreshold = 0.70;

    @Bean
    public IProductValidator productValidationChain(WebSocketConfig webSocketConfig) {

        LogicalPriceValidator logicalPrice = new LogicalPriceValidator();
        AccessoryAndVariantExclusionValidator accessoryExclusion = new AccessoryAndVariantExclusionValidator();
        SimilarityThresholdValidator similarity = new SimilarityThresholdValidator(webSocketConfig, similarityThreshold);

        logicalPrice.setNext(accessoryExclusion);
        accessoryExclusion.setNext(similarity);

        return logicalPrice;
    }
}
