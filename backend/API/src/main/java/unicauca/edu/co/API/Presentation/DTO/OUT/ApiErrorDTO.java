package unicauca.edu.co.API.Presentation.DTO.OUT;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * DTO para representar errores de autenticación.
 */
@Getter
@Setter
@AllArgsConstructor
@Builder
public class ApiErrorDTO {
    private int status;
    private String error;
    private String message;
    private String code;
    private String path;
    private long timestamp;

    public ApiErrorDTO() {
        this.timestamp = System.currentTimeMillis();
    }
}
