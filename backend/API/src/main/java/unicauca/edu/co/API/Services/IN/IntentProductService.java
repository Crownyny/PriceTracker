package unicauca.edu.co.API.Services.IN;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Mono;
import unicauca.edu.co.API.Presentation.DTO.IN.IntentResponseDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.ModelProductRequestDTO;
import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.ExceptionDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IIntentProductService;
import unicauca.edu.co.API.Services.OUT.MessengerService;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class IntentProductService implements IIntentProductService {

    private static final Logger logger = LoggerFactory.getLogger(IntentProductService.class);
    public final WebClient webClient;
    private final StrategyService strategyService;
    private final MessengerService messengerService;

    public IntentProductService(
            WebClient.Builder webClientBuilder,
            @Value("${model.product.url}") String modelProductUrl,
            StrategyService strategyService,
            MessengerService messengerService
    ) {
        this.webClient = webClientBuilder.baseUrl(modelProductUrl).build();
        this.strategyService = strategyService;
        this.messengerService = messengerService;
    }

    @Override
    public Mono<IntentResponseDTOIN> getIntentResponse(String queryTitle) {
        return webClient.post()
                .uri("/predict")
                .bodyValue(new ModelProductRequestDTO(queryTitle))
                .retrieve()
                .bodyToMono(IntentResponseDTOIN.class)
                .timeout(Duration.ofSeconds(10))
                .onErrorResume(e -> {
                    logger.error("Error al obtener respuesta del servicio de intención", e);
                    return Mono.error(new RuntimeException("Error al obtener respuesta del servicio de intención", e));
                });
    }

    
}
