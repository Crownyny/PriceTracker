package unicauca.edu.co.API.Services.Interfaces.IN;

import unicauca.edu.co.API.Presentation.DTO.OUT.FirebaseTokenDTO;

/**
 * Interfaz para el servicio de autenticación con Firebase.
 */
public interface IAuthService {
    /**
     * Valida un token JWT de Firebase y extrae la información de sus claims.
     * @param token El token JWT a validar.
     * @return FirebaseTokenDTO con la información del token.
     * @throws Exception Si el token es inválido o ocurre un error durante la validación.
     */
    FirebaseTokenDTO validateToken(String token) throws Exception;

    /**
     * Invalida la entrada del caché para un token específico.
     * @param token El token JWT para el cual se desea invalidar el caché.
     */
    void invalidateTokenCache(String token);
}
