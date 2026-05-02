package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.FirebaseTokenDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.UserDTO;
import unicauca.edu.co.API.Services.IN.UserService;
import unicauca.edu.co.API.Services.Interfaces.IN.IAuthService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


/**
 * Controlador para gestionar la autenticación con Firebase.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final IAuthService authService;
    private final UserService userService;

    public AuthController(IAuthService authService, UserService userService ) {
        this.authService = authService;
        this.userService = userService;
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

    @PostMapping("/user")
    public ResponseEntity<UserDTO> createUser(@RequestBody UserCreateDTOIN createRequest) {
        UserDTO createdUser = userService.createUser(createRequest);
        return ResponseEntity.ok(createdUser);
    }
}
