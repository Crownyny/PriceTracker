package unicauca.edu.co.API.Config;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final Map<String, String> productSessions = new ConcurrentHashMap<>();
    private final Map<String, String> productQueries = new ConcurrentHashMap<>();

    /**
     * Agrega una sesión WebSocket para un producto específico.
     * @param productRef Referencia del producto para asociar la sesión
     * @param sessionId Identificador de la sesión WebSocket del usuario
     */
    public void addSession(String productRef, String sessionId) {
        productSessions.put(productRef, sessionId);
    }

    /**
     * Agrega una sesión WebSocket y su consulta asociada para un producto.
     * @param productRef Referencia del producto para asociar la sesión
     * @param sessionId Identificador de la sesión WebSocket del usuario
     * @param searchQuery Consulta original del usuario
     */
    public void addSession(String productRef, String sessionId, String searchQuery) {
        productSessions.put(productRef, sessionId);
        if (searchQuery != null) {
            productQueries.put(productRef, searchQuery);
        }
    }

    /**
     * Obtiene la sesion WebSocket asociadas a un producto específico.
     * @param productRef Referencia del producto para obtener las sesiones asociadas
     * @return Lista de identificadores de sesiones WebSocket asociadas al producto
     */
    public String getSession(String productRef) {
        return productSessions.get(productRef);
    }

    /**
     * Obtiene la consulta asociada a una referencia de producto.
     * @param productRef Referencia del producto
     * @return Consulta original del usuario o null si no existe
     */
    public String getSearchQuery(String productRef) {
        return productQueries.get(productRef);
    }
    /**
     * Elimina una sesión WebSocket de un producto específico.
     * @param productRef Referencia del producto para desasociar la sesión
     * @param sessionId Identificador de la sesión WebSocket del usuario
     */
    public void removeSession(String productRef, String sessionId) {
        productSessions.remove(productRef, sessionId);
        productQueries.remove(productRef);
    }

    /**
     * Configura el corredor de mensajes para las sesiones WebSocket.
     * Habilita un corredor de mensajes simple con destinos "/queue" y "/topic", y establece el prefijo de destino de la aplicación en "/app".
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/queue", "/topic");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    /**
     * Registra los puntos finales de STOMP para las conexiones WebSocket.
     * Configura un punto final "/ws" que permite conexiones desde cualquier origen y habilita
     * 
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*").withSockJS();
    }
}