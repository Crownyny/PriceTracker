package unicauca.edu.co.API.Presentation.Controller;

import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuthException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import unicauca.edu.co.API.Exception.BusinessException;
import unicauca.edu.co.API.Exception.UserNotFoundException;
import unicauca.edu.co.API.Presentation.DTO.OUT.ApiErrorDTO;

/**
 * Controlador global de excepciones para estandarizar las respuestas de error.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(FirebaseAuthException.class)
    public ResponseEntity<ApiErrorDTO> handleFirebaseAuthException(FirebaseAuthException e, HttpServletRequest request) {
        String detailedMessage = mapFirebaseError(e);
        
        ApiErrorDTO errorDTO = ApiErrorDTO.builder()
                .status(HttpStatus.UNAUTHORIZED.value())
                .error("Unauthorized")
                .message(detailedMessage)
                .path(request.getRequestURI())
                .timestamp(System.currentTimeMillis())
                .build();
        
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorDTO);
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ApiErrorDTO> handleUserNotFoundException(UserNotFoundException e, HttpServletRequest request) {
        ApiErrorDTO errorDTO = ApiErrorDTO.builder()
                .status(HttpStatus.NOT_FOUND.value())
                .error("Not Found")
                .message(e.getMessage())
                .code(e.getErrorCode())
                .path(request.getRequestURI())
                .timestamp(System.currentTimeMillis())
                .build();
        
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorDTO);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorDTO> handleBusinessException(BusinessException e, HttpServletRequest request) {
        ApiErrorDTO errorDTO = ApiErrorDTO.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Business Logic Error")
                .message(e.getMessage())
                .code(e.getErrorCode())
                .path(request.getRequestURI())
                .timestamp(System.currentTimeMillis())
                .build();
        
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorDTO);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorDTO> handleIllegalArgumentException(IllegalArgumentException e, HttpServletRequest request) {
        ApiErrorDTO errorDTO = ApiErrorDTO.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Bad Request")
                .message(e.getMessage())
                .path(request.getRequestURI())
                .timestamp(System.currentTimeMillis())
                .build();
        
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorDTO);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorDTO> handleGeneralException(Exception e, HttpServletRequest request) {
        ApiErrorDTO errorDTO = ApiErrorDTO.builder()
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .error("Internal Server Error")
                .message(e.getMessage() != null ? e.getMessage() : "An unexpected error occurred")
                .path(request.getRequestURI())
                .timestamp(System.currentTimeMillis())
                .build();
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorDTO);
    }
   
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiErrorDTO> handleInvalidAlertState(
        IllegalStateException e,
        HttpServletRequest request) {

        ApiErrorDTO errorDTO = ApiErrorDTO.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Alert State Conflict")
                .message(e.getMessage() != null ? e.getMessage() : "An unexpected error occurred")
                .path(request.getRequestURI())
                .timestamp(System.currentTimeMillis())
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorDTO);
    }

    private String mapFirebaseError(FirebaseAuthException e) {
        AuthErrorCode code = e.getAuthErrorCode();
        if (code == null) return "Authentication failed: " + e.getMessage();

        return switch (code) {
            case EXPIRED_ID_TOKEN -> "The provided token has expired.";
            case INVALID_ID_TOKEN -> "The provided token is invalid.";
            case REVOKED_ID_TOKEN -> "The provided token has been revoked.";
            case USER_DISABLED -> "The user account has been disabled.";
            case USER_NOT_FOUND -> "No user found for the provided token.";
            default -> "Authentication failed: " + e.getMessage();
        };
    }
 
}
