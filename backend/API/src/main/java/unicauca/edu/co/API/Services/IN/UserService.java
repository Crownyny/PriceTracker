package unicauca.edu.co.API.Services.IN;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Domain.Model.UserRole;
import unicauca.edu.co.API.Domain.Validators.Chains.UserValidationChain;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserUpdateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.UserDTO;
import unicauca.edu.co.API.Presentation.Mapper.UserMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IFirebaseAuth;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IUserPersistencePort;

@Service
@Transactional
public class UserService implements IUserService {

    private final IUserPersistencePort userPersistencePort;
    private final IFirebaseAuth firebaseAuthPort;
    private final UserMapper userMapper;
    private final UserValidationChain userValidationChain;

    public UserService(
        IUserPersistencePort userPersistencePort,
        IFirebaseAuth firebaseAuthPort,
        UserMapper userMapper,
        UserValidationChain userValidationChain
    ) {
        this.userPersistencePort = userPersistencePort;
        this.firebaseAuthPort = firebaseAuthPort;
        this.userMapper = userMapper;  
        this.userValidationChain = userValidationChain; 
    }
    @Override
    public UserDTO createUser(UserCreateDTOIN createRequest) {
        userValidationChain.validate(createRequest);
        String firebaseUid = null;
        try {
            firebaseUid = firebaseAuthPort.createUser(
                    createRequest.getEmail(),
                    createRequest.getPassword()
            );
            User userSaved = saveUserBD(createRequest, firebaseUid);
            return userMapper.toDTO(userSaved);
        } catch (Exception e) {
            if (firebaseUid != null) {
                try {
                    firebaseAuthPort.deleteUser(firebaseUid);
                } catch (Exception ex) {
                    
                }
            }
            throw e;
        }
    }

    @Transactional
    private User saveUserBD(UserCreateDTOIN userSave, String firebaseUid) {
        User user = builderUserDomain(userSave, firebaseUid);
        return userPersistencePort.save(user);
    }
    
    @Override
    public User updateUser(UserUpdateDTOIN updateRequest) {
        if (updateRequest == null) {
            throw new IllegalArgumentException("Los datos del usuario son obligatorios");
        }

        UUID id = updateRequest.getId();
        if (id == null) {
            throw new IllegalArgumentException("El id del usuario es obligatorio");
        }

        User existingUser = userPersistencePort.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (updateRequest.getUid() != null) {
            String normalizedUid = normalizeAndValidateUid(updateRequest.getUid());

            boolean uidBelongsToAnotherUser = userPersistencePort.findByFirebaseUid(normalizedUid)
                .map(user -> !user.getId().equals(existingUser.getId()))
                .orElse(false);

            if (uidBelongsToAnotherUser) {
                throw new IllegalArgumentException("El uid de Firebase ya se encuentra registrado");
            }

            existingUser.setFirebaseUid(normalizedUid);
        }

        if (updateRequest.getEmail() != null) {
            String normalizedEmail = normalizeAndValidateEmail(updateRequest.getEmail());

            boolean emailBelongsToAnotherUser = userPersistencePort.existsByEmailIgnoreCase(normalizedEmail)
                && !normalizedEmail.equalsIgnoreCase(existingUser.getEmail());

            if (emailBelongsToAnotherUser) {
                throw new IllegalArgumentException("El correo ya se encuentra registrado");
            }

            existingUser.setEmail(normalizedEmail);
        }

        if (updateRequest.getImageProfile() != null) {
            existingUser.setImageProfile(updateRequest.getImageProfile().trim());
        }

        if (updateRequest.getRole() != null) {
            existingUser.setRole(updateRequest.getRole());
        }

        if (updateRequest.getDeleteAt() != null) {
            existingUser.setDeletedAt(updateRequest.getDeleteAt());
        }

        return userPersistencePort.save(existingUser);
    }

    @Override
    public User findOrCreateUserFromToken(String uid, String email) {
        String normalizedUid = normalizeOptionalValue(uid);
        String normalizedEmail = normalizeOptionalEmail(email);


        if (!hasText(normalizedUid) && !hasText(normalizedEmail)) {
            throw new IllegalArgumentException("El token no contiene uid ni correo del usuario");
        }

        if (hasText(normalizedUid)) {
            User userByUid = userPersistencePort.findByFirebaseUid(normalizedUid).orElse(null);
            if (userByUid != null) {
                return updateUserWithTokenData(userByUid, normalizedUid, normalizedEmail);
            }
        }

        if (hasText(normalizedEmail)) {
            User userByEmail = userPersistencePort.findByEmail(normalizedEmail).orElse(null);
            if (userByEmail != null) {
                return updateUserWithTokenData(userByEmail, normalizedUid, normalizedEmail);
            }
        }

        UserCreateDTOIN createRequest = new UserCreateDTOIN();
        createRequest.setEmail(resolveEmailForCreation(normalizedEmail, normalizedUid));
        User createdUser = saveUserBD(createRequest, uid);
        return createdUser;
    }

    private String normalizeAndValidateUid(String uid) {
        if (!hasText(uid)) {
            throw new IllegalArgumentException("El uid de Firebase es obligatorio");
        }
        return uid.trim();
    }

        private String normalizeAndValidateEmail(String email) {
            if (!hasText(email)) {
                throw new IllegalArgumentException("El correo del usuario es obligatorio");
            }
            return email.trim().toLowerCase();
        }

    private User updateUserWithTokenData(User existingUser, String uid, String email) {
        boolean changed = false;

        if (hasText(uid) && !uid.equals(existingUser.getFirebaseUid())) {
            boolean uidBelongsToAnotherUser = userPersistencePort.findByFirebaseUid(uid)
                .map(user -> !user.getId().equals(existingUser.getId()))
                .orElse(false);

            if (!uidBelongsToAnotherUser) {
                existingUser.setFirebaseUid(uid);
                changed = true;
            }
        }

        if (hasText(email) && !email.equalsIgnoreCase(existingUser.getEmail())) {
            boolean emailBelongsToAnotherUser = userPersistencePort.existsByEmailIgnoreCase(email)
                && !email.equalsIgnoreCase(existingUser.getEmail());

            if (!emailBelongsToAnotherUser) {
                existingUser.setEmail(email);
                changed = true;
            }
        }

        

        return changed ? userPersistencePort.save(existingUser) : existingUser;
    }

    @Override
    public User upgradeToPremium(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException("El id del usuario es obligatorio");
        }

        User user = userPersistencePort.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (user.getRole() == UserRole.premium) {
            return user; // ya es premium
        }

        user.setRole(UserRole.premium);
        return userPersistencePort.save(user);
    }
    @Override
    public User downgradeToFreemium(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException("El id del usuario es obligatorio");
        }

        User user = userPersistencePort.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (user.getRole() == UserRole.registered) {
            return user; // ya es freemium
        }

        user.setRole(UserRole.registered);
        return userPersistencePort.save(user);
    }

    @Override
    public User findById(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException("El id del usuario es obligatorio");
        }
        return userPersistencePort.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
    }
    
    private String normalizeOptionalValue(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private String normalizeOptionalEmail(String email) {
        return hasText(email) ? email.trim().toLowerCase() : null;
    }

    private String resolveUidForCreation(String uid, String email) {
        if (hasText(uid)) {
            return uid;
        }
        return "email:" + email;
    }

    private String resolveEmailForCreation(String email, String uid) {
        if (hasText(email)) {
            return email;
        }
        return uid + "@firebase.local";
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    /**
     * Construye un objeto User a partir de un UserCreateDTOIN y un firebaseId.
     * @param createUser inforamcion a crear del dto
     * @param firebaseid firebaseID desde firebase
     * @return user creado
     */
    private User builderUserDomain(UserCreateDTOIN createUser, String firebaseid) {
        return User.builder()
                .id(UUID.randomUUID())
                .firebaseUid(firebaseid)
                .email(createUser.getEmail())
                .role(UserRole.registered)
                .createdAt(LocalDateTime.now())
                .build();
    }
}