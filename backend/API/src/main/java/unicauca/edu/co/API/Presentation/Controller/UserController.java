package unicauca.edu.co.API.Presentation.Controller;


import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import unicauca.edu.co.API.DataAccess.Entity.UserEntity.UserRole;
import unicauca.edu.co.API.Presentation.DTO.IN.GoogleSignInDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserRoleUpdateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.UserDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.UserRoleDTO;
import unicauca.edu.co.API.Presentation.Mapper.UserMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IUserRoleService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
@RequestMapping("/api/v1/user")
public class UserController {

    private final IUserService userService;
    private final IUserRoleService userRoleService;
    private final UserMapper userMapper;

    public UserController(IUserService userService, IUserRoleService userRoleService, UserMapper userMapper) {
        this.userService = userService;
        this.userRoleService = userRoleService;
        this.userMapper = userMapper;
    }

    @PostMapping()
    public ResponseEntity<UserDTO> createUser(@RequestBody UserCreateDTOIN createRequest) {
        UserDTO createdUser = userService.createUser(createRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdUser);
    }

    /**
     * Endpoint para crear o autenticar usuario a través de Google Sign-In.
     * El cliente envía el token de ID de Google, y este endpoint:
     * 1. Verifica el token con Firebase
     * 2. Si el usuario existe (por Firebase UID o email), lo retorna
     * 3. Si no existe, crea un nuevo usuario en la BD con datos de Google
     * 
     * @param googleSignIn DTO con el token de Google desde el cliente
     * @return UserDTO del usuario creado o encontrado
     */
    @PostMapping("/google-signin")
    public ResponseEntity<UserDTO> googleSignIn(@RequestBody GoogleSignInDTOIN googleSignIn) {
        UserDTO user = userService.createUserFromGoogle(googleSignIn);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    /**
     * Actualiza el rol de un usuario de 'registered' (freemium) a 'premium'.
     * Este endpoint maneja las siguientes excepciones:
     * - BusinessException: Si el userId o el newRole son null, o si el usuario ya tiene el rol solicitado
     * - UserNotFoundException: Si no se encuentra el usuario con el ID proporcionado
     * 
     * @param userId ID del usuario a actualizar
     * @param updateRequest DTO con el nuevo rol
     * @return ResponseEntity con el usuario actualizado
     */
    @PutMapping("/role")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserDTO> updateUserRole(
            @RequestBody UserRoleUpdateDTOIN updateRequest) {
    
        UserDTO updatedUser = userService.updateUserRole( updateRequest.getNewRole());
        return ResponseEntity.ok(updatedUser);
    }
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/role")
    public ResponseEntity<UserRoleDTO> getUserRole() {
        UserRoleDTO userRole = userRoleService.getUserRole();
        return ResponseEntity.ok(userRole);
    }

}
