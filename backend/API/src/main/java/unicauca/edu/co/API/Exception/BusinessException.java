package unicauca.edu.co.API.Exception;

import unicauca.edu.co.API.Domain.Model.ErrorType;

/**
 * Excepción base para errores de lógica de negocio.
 * Se lanza cuando se viola una regla de negocio durante la ejecución de una operación.
 */
public class BusinessException extends RuntimeException {

    private final String errorCode;
    private final ErrorType errorType;

    public BusinessException(String message) {
        super(message);
        this.errorCode = "BUSINESS_ERROR";
        this.errorType = ErrorType.BUSINESS_ERROR;
    }

    public BusinessException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
        this.errorType = ErrorType.BUSINESS_ERROR;
    }

    public BusinessException(String message, ErrorType errorType) {
        super(message);
        this.errorCode = errorType.getCode();
        this.errorType = errorType;
    }

    public BusinessException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "BUSINESS_ERROR";
        this.errorType = ErrorType.BUSINESS_ERROR;
    }

    public BusinessException(String message, String errorCode, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.errorType = ErrorType.BUSINESS_ERROR;
    }

    public BusinessException(String message, ErrorType errorType, Throwable cause) {
        super(message, cause);
        this.errorCode = errorType.getCode();
        this.errorType = errorType;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public ErrorType getErrorType() {
        return errorType;
    }
}