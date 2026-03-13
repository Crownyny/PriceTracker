package unicauca.edu.co.API.Services;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.databind.ObjectMapper;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Services.Interfaces.IScrapingService;

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
    
    public ScrapingService(RabbitTemplate rabbitTemplate, ObjectMapper objectMapper) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Envía un query de scraping a la cola de RabbitMQ.
     *
     * @param query el query con los detalles del producto a scrapear
     */
    @Override
    public void sendData(QueryDTOIN query) {
        try {
            // Convertir el query a JSON
            String queryJson = objectMapper.writeValueAsString(query);
            
            logger.info("Enviando query a la cola '{}': {}", SCRAPING_QUEUE, queryJson);
            
            // Enviar el mensaje a la cola
            rabbitTemplate.convertAndSend(SCRAPING_QUEUE, queryJson);
            
            logger.info("Query enviado exitosamente a la cola '{}'", SCRAPING_QUEUE);
            
        } catch (Exception e) {
            logger.error("Error al enviar query a la cola '{}': {}", SCRAPING_QUEUE, e.getMessage(), e);
            throw new RuntimeException("Error al enviar query al scraper: " + e.getMessage(), e);
        }
    }

    /**
     * Escucha la cola de resultados de RabbitMQ y procesa los mensajes.
     *
     * @param message el mensaje recibido de la cola
     */
    @RabbitListener(queues = "scrapping.results")
    public void listenToResults(@Payload String message) {
        try {
            logger.info("Mensaje recibido de la cola 'scrapping.results': {}", message);
            // Aquí puedes agregar lógica para manejar el mensaje recibido
        } catch (Exception e) {
            logger.error("Error al procesar mensaje de la cola 'scrapping.results': {}", e.getMessage(), e);
        }
    }
}
