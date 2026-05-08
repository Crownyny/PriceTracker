package unicauca.edu.co.API.Services.IN;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import unicauca.edu.co.API.Config.Security.AuthenticatedUserPrincipal;
import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Domain.Model.UserRole;
import unicauca.edu.co.API.Domain.Model.ErrorType;
import unicauca.edu.co.API.Domain.Validators.Chains.UserValidationChain;
import unicauca.edu.co.API.Exception.BusinessException;
import unicauca.edu.co.API.Exception.UserNotFoundException;
import unicauca.edu.co.API.Presentation.DTO.IN.GoogleSignInDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserUpdateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.GoogleUserInfoDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.UserDTO;
import unicauca.edu.co.API.Presentation.Mapper.UserMapper;
import unicauca.edu.co.API.Services.Interfaces.IN.IFirebaseAuth;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IUserPersistencePort;

import com.google.firebase.auth.FirebaseToken;

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

    /**
     * Crea o encuentra un usuario a través de Google Sign-In.
     * Si el usuario ya existe (por email o Firebase UID), lo actualiza.
     * Si no existe, lo crea automáticamente en la BD.
     * 
     * @param googleSignIn DTO con el token de Google
     * @return UserDTO del usuario creado o encontrado
     */
    @Override
    @Transactional
    public UserDTO createUserFromGoogle(GoogleSignInDTOIN googleSignIn) {
        if (googleSignIn == null || googleSignIn.getIdToken() == null || googleSignIn.getIdToken().isEmpty()) {
            throw new BusinessException("El token de Google es obligatorio", ErrorType.INVALID_PARAMETER);
        }

        try {
            // Verificar el token de Google con Firebase
            FirebaseToken decodedToken = firebaseAuthPort.verifyIdToken(googleSignIn.getIdToken());
            GoogleUserInfoDTO googleUserInfo = extractGoogleUserInfo(decodedToken);

            // Buscar si el usuario ya existe
            User existingUser = userPersistencePort.findByFirebaseUid(googleUserInfo.getFirebaseUid())
                .orElse(null);

            if (existingUser != null) {
                // El usuario ya existe, actualizar información si es necesario
                boolean updated = false;

                if (googleUserInfo.getEmail() != null && !googleUserInfo.getEmail().equalsIgnoreCase(existingUser.getEmail())) {
                    existingUser.setEmail(googleUserInfo.getEmail());
                    updated = true;
                }

                if (googleUserInfo.getProfilePicture() != null && !googleUserInfo.getProfilePicture().equals(existingUser.getImageProfile())) {
                    existingUser.setImageProfile(googleUserInfo.getProfilePicture());
                    updated = true;
                }

                if (updated) {
                    userPersistencePort.save(existingUser);
                }

                return userMapper.toDTO(existingUser);
            }

            // El usuario no existe, crear uno nuevo
            User newUser = buildUserFromGoogle(googleUserInfo);
            User savedUser = userPersistencePort.save(newUser);

            return userMapper.toDTO(savedUser);

        } catch (Exception e) {
            throw new BusinessException("Error al verificar token de Google: " + e.getMessage(), ErrorType.BUSINESS_ERROR);
        }
    }

    /**
     * Extrae la información del usuario desde el token de Firebase de Google.
     */
    private GoogleUserInfoDTO extractGoogleUserInfo(FirebaseToken decodedToken) {
        return GoogleUserInfoDTO.builder()
                .firebaseUid(decodedToken.getUid())
                .email(decodedToken.getEmail())
                .name((String) decodedToken.getClaims().get("name"))
                .profilePicture((String) decodedToken.getClaims().get("picture"))
                .provider("google")
                .build();
    }

    /**
     * Construye un nuevo usuario desde la información de Google.
     */
    private User buildUserFromGoogle(GoogleUserInfoDTO googleUserInfo) {
        return User.builder()
                .id(UUID.randomUUID())
                .firebaseUid(googleUserInfo.getFirebaseUid())
                .email(googleUserInfo.getEmail())
                .imageProfile(googleUserInfo.getProfilePicture())
                .role(UserRole.registered)
                .createdAt(LocalDateTime.now())
                .build();
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
    public UserDTO updateUserRole(UserRole newRole) {
        UUID userId = getCurrentUserId();
        if (userId == null) {
            throw new BusinessException("User id is required", ErrorType.MISSING_USER_ID);
        }

        if (newRole == null) {
            throw new BusinessException("User role is required", ErrorType.MISSING_USER_ROLE);
        }

        User user = userPersistencePort.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if (user.getRole() == newRole) {
            throw new BusinessException("User already has role: " + newRole, ErrorType.USER_ALREADY_HAS_ROLE);
        }

        user.setRole(newRole);
        User userSave = userPersistencePort.save(user);
        return userMapper.toDTO(userSave);
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
    @Override
    public UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext()
            .getAuthentication()
            .getPrincipal();

        if (principal instanceof AuthenticatedUserPrincipal user) {
            return user.id(); 
        }

        throw new IllegalStateException("User not authenticated");
    }
}