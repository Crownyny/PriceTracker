package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import unicauca.edu.co.API.Presentation.DTO.OUT.FirebaseTokenDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IAuthService;

/**
 * Controlador para gestionar la autenticación con Firebase.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final IAuthService authService;

    public AuthController(IAuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/validate")
    public ResponseEntity<?> validateToken(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) throws Exception {
        if (authorizationHeader == null) {
            throw new IllegalArgumentException("Missing Authorization header");
        }

        if (!authorizationHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Invalid Authorization header format. Must start with 'Bearer '");
        }

        String token = authorizationHeader.replace("Bearer ", "");
        FirebaseTokenDTO tokenDTO = authService.validateToken(token);
        return ResponseEntity.ok(tokenDTO);
    }

    /**
     * Invalida el caché para un token específico.
     */
    @PostMapping("/invalidate")
    public ResponseEntity<Void> invalidateToken(@RequestBody String token) {
        authService.invalidateTokenCache(token);
        return ResponseEntity.ok().build();
    }
}
