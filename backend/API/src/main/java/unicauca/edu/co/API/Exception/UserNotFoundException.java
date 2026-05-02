package unicauca.edu.co.API.Exception;

import java.util.UUID;

import unicauca.edu.co.API.Domain.Model.ErrorType;

/**
 * Excepción lanzada cuando no se encuentra un usuario.
 */
public class UserNotFoundException extends BusinessException {

    public UserNotFoundException(UUID userId) {
        super("User not found with id: " + userId, ErrorType.USER_NOT_FOUND);
    }

    public UserNotFoundException(String message) {
        super(message, ErrorType.USER_NOT_FOUND);
    }

    public UserNotFoundException(String message, Throwable cause) {
        super(message, ErrorType.USER_NOT_FOUND, cause);
    }
}