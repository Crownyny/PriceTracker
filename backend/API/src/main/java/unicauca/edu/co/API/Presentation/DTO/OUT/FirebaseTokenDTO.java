package unicauca.edu.co.API.Presentation.DTO.OUT;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO que representa la información extraída de un JWT de Firebase.
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class FirebaseTokenDTO {
    // Identity
    private String uid;
    private String sub;

    // User Information
    private String email;
    private boolean emailVerified;
    private String name;
    private String picture;

    // Provider
    private String signInProvider;

    // Security
    private long iat; // Issued at
    private long exp; // Expiration time
    private String iss; // Issuer
    private String aud; // Audience
}
