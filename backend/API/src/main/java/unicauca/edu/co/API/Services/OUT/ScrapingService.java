package unicauca.edu.co.API.Services.OUT;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.databind.ObjectMapper;

import unicauca.edu.co.API.Presentation.DTO.Enum.ProcessStatus;
import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.ProcessStatusDTO;
import unicauca.edu.co.API.Services.Interfaces.OUT.IMessengerService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IScrapingService;

/**
 * Servicio de Scraping que envía queries a la cola de RabbitMQ.
 * Se encarga de publicar las solicitudes de scraping hacia el servicio de scraping.
 */
@Service
public class ScrapingService implements IScrapingService {
    
    private static final Logger logger = LoggerFactory.getLogger(ScrapingService.class);
    private static final String SCRAPING_QUEUE = "scraping.jobs";
    
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final IMessengerService messengerService;

    public ScrapingService(RabbitTemplate rabbitTemplate, ObjectMapper objectMapper, IMessengerService messengerService) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.messengerService = messengerService;   
    }

    
    @Override
    public void sendData(QueryDTOIN query) {
        try {
            String queryJson = objectMapper.writeValueAsString(query);
            logger.info("Enviando query a la cola '{}': {}", SCRAPING_QUEUE, queryJson);
            rabbitTemplate.convertAndSend(SCRAPING_QUEUE, queryJson);
            ProcessStatusDTO status = new ProcessStatusDTO(ProcessStatus.SCRAPING);
            messengerService.sendProcessStatus(status, query.getProduct_ref());
            logger.info("Query enviado exitosamente a la cola '{}'", SCRAPING_QUEUE);
        } catch (Exception e) {
            logger.error("Error al enviar query a la cola '{}': {}", SCRAPING_QUEUE, e.getMessage(), e);
            throw new RuntimeException("Error al enviar query al scraper: " + e.getMessage(), e);
        }
    }


}
