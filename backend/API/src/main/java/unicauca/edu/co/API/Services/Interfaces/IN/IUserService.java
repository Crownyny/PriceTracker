package unicauca.edu.co.API.Services.Interfaces.IN;

import java.util.UUID;

import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserUpdateDTOIN;

public interface IUserService {

    User createUser(UserCreateDTOIN createRequest);

    User updateUser(UserUpdateDTOIN updateRequest);

    User findOrCreateUserFromToken(String uid, String email, String picture);

    /**
     * Busca un usuario por su ID.
     * @param userId El ID del usuario a buscar.
     * @return El usuario encontrado o null si no existe.   
     */
    User findById(UUID userId);
    /**
     * Actualiza el rol del usuario de fremmium (registered) a premium.
     * @param userId El ID del usuario a actualizar.
     * @return El usuario actualizado con el nuevo rol.
     */
    User upgradeToPremium(UUID userId);

    /**
     * Actualiza el rol del premium a fremmium (registered).
     * @param userId El ID del usuario a actualizar.
     * @return El usuario actualizado con el nuevo rol.
     */
    User downgradeToFreemium(UUID userId);
}
