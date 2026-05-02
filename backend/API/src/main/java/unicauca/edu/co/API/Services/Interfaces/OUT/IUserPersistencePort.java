package unicauca.edu.co.API.Services.Interfaces.OUT;

import java.util.Optional;
import java.util.UUID;

import unicauca.edu.co.API.Domain.Model.User;

public interface IUserPersistencePort {

    Optional<User> findById(UUID id);

    Optional<User> findByEmail(String email);

    Optional<User> findByFirebaseUid(String firebaseUid);

    boolean existsByEmailIgnoreCase(String email);

    User save(User user);

    /**
     * Elimina un usuario por su ID y devuelve el usuario eliminado si existía, o un Optional vacío si no se encontró.
     * @param id ID del usuario a eliminar
     * @return Optional con el usuario eliminado si existía, o Optional vacío si no se encontró un usuario con ese ID
     */
    Optional<User> delete(UUID id);
}
