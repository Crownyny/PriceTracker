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
}
