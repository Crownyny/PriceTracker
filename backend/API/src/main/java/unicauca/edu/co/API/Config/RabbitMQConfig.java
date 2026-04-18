package unicauca.edu.co.API.Config;

import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.amqp.support.converter.SimpleMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

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
     * Proporciona un ObjectMapper como Bean con soporte para Java 8 date/time types.
     * Registra el módulo JavaTimeModule para deserializar LocalDateTime, LocalDate, etc.
     * @return ObjectMapper configurado
     */
    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule()); // Permite deserializar LocalDateTime
        mapper.findAndRegisterModules(); // También registra otros módulos automáticamente
        return mapper;
    }
}