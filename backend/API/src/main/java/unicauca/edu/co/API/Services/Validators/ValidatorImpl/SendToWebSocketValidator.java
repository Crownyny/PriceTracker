package unicauca.edu.co.API.Services.Validators.ValidatorImpl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Interfaces.OUT.IMessengerService;
import unicauca.edu.co.API.Services.Validators.InterfacesValidators.AbstractProductValidator;

/**
 * Envía el producto al WebSocket del usuario
 * solo si pasó todos los validadores anteriores
 */
public class SendToWebSocketValidator extends AbstractProductValidator {

    private static final Logger logger = LoggerFactory.getLogger(SendToWebSocketValidator.class);

    private final IMessengerService messengerService;

    public SendToWebSocketValidator(IMessengerService messengerService) {
        this.messengerService = messengerService;
    }

    @Override
    public void validate(NormalizedProductDTO request) {
        if (request == null) {
            return;
        }
        try {
            messengerService.sendToWebSocket(request);
        } catch (Exception e) {
            logger.error("Error al enviar producto al WebSocket: productRef={}", request.getProductRef(), e);
        }
    }
}
