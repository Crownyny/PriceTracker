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