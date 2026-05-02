package unicauca.edu.co.API.Exception;

import java.util.UUID;

/**
 * Excepción lanzada cuando no se encuentra un usuario.
 */
public class UserNotFoundException extends BusinessException {

    public UserNotFoundException(UUID userId) {
        super("User not found with id: " + userId, "USER_NOT_FOUND");
    }

    public UserNotFoundException(String message) {
        super(message, "USER_NOT_FOUND");
    }

    public UserNotFoundException(String message, Throwable cause) {
        super(message, "USER_NOT_FOUND", cause);
    }
}