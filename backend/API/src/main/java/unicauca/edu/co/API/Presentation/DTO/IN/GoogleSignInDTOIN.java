package unicauca.edu.co.API.Presentation.DTO.IN;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para recibir el token de Google desde el frontend.
 * El cliente envía el ID token obtenido desde el SDK de Google.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GoogleSignInDTOIN {
    
    /**
     * Token de ID obtenido desde Google Sign-In SDK en el cliente
     */
    @JsonProperty("idToken")
    private String idToken;
    
    /**
     * Email del usuario (opcional, puede venir en el token)
     */
    @JsonProperty("email")
    private String email;
    
    /**
     * Nombre del usuario (opcional)
     */
    @JsonProperty("name")
    private String name;
    
    /**
     * URL de la foto de perfil (opcional)
     */
    @JsonProperty("profilePicture")
    private String profilePicture;
}
