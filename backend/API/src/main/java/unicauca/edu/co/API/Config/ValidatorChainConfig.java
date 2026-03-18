package unicauca.edu.co.API.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import unicauca.edu.co.API.Services.Interfaces.OUT.IMessengerService;
import unicauca.edu.co.API.Services.Validators.InterfacesValidators.IProductValidator;
import unicauca.edu.co.API.Services.Validators.ValidatorImpl.AccessoryAndVariantExclusionValidator;
import unicauca.edu.co.API.Services.Validators.ValidatorImpl.LogicalPriceValidator;
import unicauca.edu.co.API.Services.Validators.ValidatorImpl.SendToWebSocketValidator;
import unicauca.edu.co.API.Services.Validators.ValidatorImpl.SimilarityThresholdValidator;

/**
 * Configura la cadena de responsabilidad de validadores (HU-1 a HU-7).
 * Orden: precio lógico → exclusión accesorios/variantes → umbral de similitud → envío WebSocket.
 */
@Configuration
public class ValidatorChainConfig {

    @Value("${app.validation.similarity-threshold:0.70}")
    private double similarityThreshold = 0.70;

    @Bean
    public IProductValidator productValidationChain(
            WebSocketConfig webSocketConfig,
            IMessengerService messengerService) {

        LogicalPriceValidator logicalPrice = new LogicalPriceValidator();
        AccessoryAndVariantExclusionValidator accessoryExclusion = new AccessoryAndVariantExclusionValidator();
        SimilarityThresholdValidator similarity = new SimilarityThresholdValidator(webSocketConfig, similarityThreshold);
        SendToWebSocketValidator sendToWebSocket = new SendToWebSocketValidator(messengerService);

        logicalPrice.setNext(accessoryExclusion);
        accessoryExclusion.setNext(similarity);
        similarity.setNext(sendToWebSocket);

        return logicalPrice;
    }
}
