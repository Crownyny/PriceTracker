package unicauca.edu.co.API.Services.IN.Email.DTO;

/**
 * Direccion del cambio de precio calculada para un producto.
 */
public enum PriceChangeDirection {
    /** El precio subio. */
    UP,
    /** El precio bajo. */
    DOWN,
    /** El precio se mantuvo igual. */
    SAME
}
