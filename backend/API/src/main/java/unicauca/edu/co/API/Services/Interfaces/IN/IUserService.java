package unicauca.edu.co.API.Services.Interfaces.IN;

import java.util.UUID;

import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Domain.Model.UserRole;
import unicauca.edu.co.API.Presentation.DTO.IN.GoogleSignInDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserUpdateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.UserDTO;

public interface IUserService {

    UserDTO createUser(UserCreateDTOIN createRequest);
    
    /**
     * Crea o encuentra un usuario a través de Google Sign-In.
     * @param googleSignIn DTO con el token de Google desde el cliente
     * @return UserDTO del usuario creado o encontrado
     */
    UserDTO createUserFromGoogle(GoogleSignInDTOIN googleSignIn);

    User updateUser(UserUpdateDTOIN updateRequest);

    User findOrCreateUserFromToken(String uid, String email);

    /**
     * Busca un usuario por su ID.
     * @param userId El ID del usuario a buscar.
     * @return USER El usuario encontrado o null si no existe.   
     */
    User findById(UUID userId);
    
    /**
     * Actualiza el rol del usuario de fremmium (registered) a premium.
     * @param newRole El nuevo rol a asignar al usuario.
     * @return El usuario actualizado con el nuevo rol.
     * @throws BusinessException Si el userId o newRole son null, o si el usuario ya tiene el rol solicitado.
     * @throws UserNotFoundException Si no se encuentra el usuario con el ID proporcionado.
     */
    UserDTO updateUserRole(UserRole newRole);
}
