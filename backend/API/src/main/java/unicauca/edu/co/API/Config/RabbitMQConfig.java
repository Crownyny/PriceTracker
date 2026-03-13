package unicauca.edu.co.API.Config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.amqp.support.converter.SimpleMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Configuración de RabbitMQ para la aplicación.
 * Define las colas, exchanges y bindings necesarios.
 */
@Configuration
public class RabbitMQConfig {
    
    // Nombre de la cola
    public static final String SCRAPING_QUEUE = "scraping.jobs";
    
    /**
     * Define la cola de scraping.
     * @return Queue para scraping jobs
     */
    @Bean
    public Queue scrapingQueue() {
        return new Queue(SCRAPING_QUEUE, true, false, false);
    }
    
    /**
     * Configura el convertidor de mensajes.
     * @return MessageConverter
     */
    @Bean
    public MessageConverter messageConverter() {
        return new SimpleMessageConverter();
    }
    
    /**
     * Proporciona un ObjectMapper como Bean.
     * @return ObjectMapper
     */
    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}