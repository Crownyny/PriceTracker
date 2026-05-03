package unicauca.edu.co.API.Presentation.DTO.OUT;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO que contiene la información extraída del token de Google
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GoogleUserInfoDTO {
    
    /**
     * UID de Firebase (obtenido del token verificado)
     */
    private String firebaseUid;
    
    /**
     * Email del usuario de Google
     */
    private String email;
    
    /**
     * Nombre del usuario (si está disponible)
     */
    private String name;
    
    /**
     * URL de la foto de perfil (si está disponible)
     */
    private String profilePicture;
    
    /**
     * Proveedor de autenticación (siempre "google")
     */
    private String provider;
}
