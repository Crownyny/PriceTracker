package unicauca.edu.co.API.Domain.Model;

/**
 * Enum que define los tipos de errores que pueden ocurrir en la aplicación.
 * Cada tipo de error tiene un código y descripción asociados.
 */
public enum ErrorType {

    /**
     * Error cuando se intenta crear una alerta que ya existe para un usuario y producto
     */
    ALERT_ALREADY_EXISTS("ALERT_EXISTS", "El usuario ya tiene una alerta activa para este producto"),

    /**
     * Error cuando se proporciona un parámetro incorrecto (ej: enum inválido)
     */
    INVALID_PARAMETER("INVALID_PARAM", "Parámetro inválido proporcionado"),

    /**
     * Error cuando la contraseña tiene un formato incorrecto
     */
    INVALID_PASSWORD_FORMAT("INVALID_PASSWORD", "La contraseña debe tener al menos 6 caracteres"),

    /**
     * Error cuando el correo electrónico tiene un formato incorrecto
     */
    INVALID_EMAIL_FORMAT("INVALID_EMAIL", "El formato del correo electrónico es incorrecto"),

    /**
     * Error de lógica de negocio general
     */
    BUSINESS_ERROR("BUSINESS_ERROR", "Error en la lógica de negocio"),

    /**
     * Error cuando un usuario no es encontrado
     */
    USER_NOT_FOUND("USER_NOT_FOUND", "El usuario no fue encontrado"),

    /**
     * Error cuando se intenta asignar un rol que el usuario ya tiene
     */
    USER_ALREADY_HAS_ROLE("USER_ROLE_CONFLICT", "El usuario ya tiene ese rol asignado"),

    /**
     * Error cuando el ID de usuario es requerido pero no se proporciona
     */
    MISSING_USER_ID("MISSING_USER_ID", "El ID del usuario es obligatorio"),

    /**
     * Error cuando el rol de usuario es requerido pero no se proporciona
     */
    MISSING_USER_ROLE("MISSING_USER_ROLE", "El rol del usuario es obligatorio"),

    /**
     * Error cuando se intenta agregar un producto a la lista de deseos que ya existe
     */
    PRODUCT_ALREADY_IN_WISHLIST("PRODUCT_IN_WISHLIST", "El producto ya se encuentra en la lista de deseos");

    private final String code;
    private final String description;

    ErrorType(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public String getCode() {
        return code;
    }

    public String getDescription() {
        return description;
    }

    @Override
    public String toString() {
        return code + ": " + description;
    }
}
