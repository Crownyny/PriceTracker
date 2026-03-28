package unicauca.edu.co.API.Services.OUT;

import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import unicauca.edu.co.API.Presentation.DTO.Enum.ProcessStatus;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.ProcessStatusDTO;
import unicauca.edu.co.API.Services.Events.NormalizedProductReceivedEvent;
import unicauca.edu.co.API.Services.Interfaces.OUT.INormalizerProductService;

@Service
public class NormalizerProductService implements INormalizerProductService {
    private final String WEBSOCKET_PRODUCTS = "/queue/products";
    private final MessengerService messengerService;

    public NormalizerProductService(MessengerService messengerService) {
        this.messengerService = messengerService;
    }

    @Async
    @EventListener
    public void handleNormalizedProduct(NormalizedProductReceivedEvent event) {
        NormalizedProductDTO product = event.getProduct();
        sendNormalizedProductToWebSocket(product);
    }

     @Override
     @Async
     public void sendNormalizedProductToWebSocket(NormalizedProductDTO product) {
        ProcessStatusDTO status = new ProcessStatusDTO(ProcessStatus.NORMALIZING);
        System.out.println("Enviando estado de proceso NORMALIZING para productRef: " + product.getProductRef());
        messengerService.sendProcessStatus(status, product.getProductRef());
        messengerService.sendToWebSocket(product.getProductRef(), WEBSOCKET_PRODUCTS, product);
     }
    

}
