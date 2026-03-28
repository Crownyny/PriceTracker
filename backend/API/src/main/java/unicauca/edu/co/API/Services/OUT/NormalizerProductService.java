package unicauca.edu.co.API.Services.OUT;

import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import unicauca.edu.co.API.Presentation.DTO.Enum.ProcessStatus;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormlaizedProductEventDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.ProcessStatusDTO;
import unicauca.edu.co.API.Services.Events.NormalizedProductReceivedEvent;
import unicauca.edu.co.API.Services.Events.NormlaizedProductFinalizedEvent;
import unicauca.edu.co.API.Services.Interfaces.OUT.IMessengerService;
import unicauca.edu.co.API.Services.Interfaces.OUT.INormalizerProductService;

@Service
public class NormalizerProductService implements INormalizerProductService {
    private final String WEBSOCKET_PRODUCTS = "/queue/products";
    private final IMessengerService messengerService;

    public NormalizerProductService(IMessengerService messengerService) {
        this.messengerService = messengerService;
    }

    @Async
    @EventListener
    public void handleNormalizedProduct(NormalizedProductReceivedEvent event) {
        NormalizedProductDTO product = event.getProduct();
        sendNormalizedProductToWebSocket(product);
    }

    @Async
    @EventListener
    public void handleNormalizedProductFinalized(NormlaizedProductFinalizedEvent event) {
        NormlaizedProductEventDTO productReceivedEventDTO = event.getNormalizedProductEventDTO();
        ProcessStatusDTO status = new ProcessStatusDTO(ProcessStatus.FINISHED);
        System.out.println("Enviando estado de proceso FINISHED para productRef: " + productReceivedEventDTO.getProductRef());
        messengerService.sendProcessStatus(status, productReceivedEventDTO.getProductRef());
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
