package unicauca.edu.co.API.Services.IN;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Domain.Model.UserRole;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserUpdateDTOIN;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IUserPersistencePort;

@Service
@Transactional
public class UserService implements IUserService {

    private final IUserPersistencePort userPersistencePort;

    public UserService(IUserPersistencePort userPersistencePort) {
        this.userPersistencePort = userPersistencePort;
    }

    @Override
    public User createUser(UserCreateDTOIN createRequest) {
        if (createRequest == null) {
            throw new IllegalArgumentException("Los datos del usuario son obligatorios");
        }

        String normalizedUid = normalizeAndValidateUid(createRequest.getUid());
        String normalizedEmail = normalizeAndValidateEmail(createRequest.getEmail());

        if (userPersistencePort.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("El correo ya se encuentra registrado");
        }

        if (userPersistencePort.findByFirebaseUid(normalizedUid).isPresent()) {
            throw new IllegalArgumentException("El uid de Firebase ya se encuentra registrado");
        }

        User user = User.builder()
            .id(UUID.randomUUID())
            .firebaseUid(normalizedUid)
            .email(normalizedEmail)
            .imageProfile(hasText(createRequest.getPicture()) ? createRequest.getPicture().trim() : "")
            .role(createRequest.getRole() != null ? createRequest.getRole() : UserRole.registered)
            .createdAt(LocalDateTime.now())
            .build();

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
    public User findOrCreateUserFromToken(String uid, String email, String picture) {
        String normalizedUid = normalizeOptionalValue(uid);
        String normalizedEmail = normalizeOptionalEmail(email);
        String normalizedPicture = normalizeOptionalValue(picture);

        if (!hasText(normalizedUid) && !hasText(normalizedEmail)) {
            throw new IllegalArgumentException("El token no contiene uid ni correo del usuario");
        }

        if (hasText(normalizedUid)) {
            User userByUid = userPersistencePort.findByFirebaseUid(normalizedUid).orElse(null);
            if (userByUid != null) {
                return updateUserWithTokenData(userByUid, normalizedUid, normalizedEmail, normalizedPicture);
            }
        }

        if (hasText(normalizedEmail)) {
            User userByEmail = userPersistencePort.findByEmail(normalizedEmail).orElse(null);
            if (userByEmail != null) {
                return updateUserWithTokenData(userByEmail, normalizedUid, normalizedEmail, normalizedPicture);
            }
        }

        UserCreateDTOIN createRequest = new UserCreateDTOIN();
        createRequest.setUid(resolveUidForCreation(normalizedUid, normalizedEmail));
        createRequest.setEmail(resolveEmailForCreation(normalizedEmail, normalizedUid));
        createRequest.setPicture(hasText(normalizedPicture) ? normalizedPicture : "");
        createRequest.setRole(UserRole.registered);

        return createUser(createRequest);
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

    private User updateUserWithTokenData(User existingUser, String uid, String email, String picture) {
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

        if (hasText(picture) && !picture.equals(existingUser.getImageProfile())) {
            existingUser.setImageProfile(picture);
            changed = true;
        }

        return changed ? userPersistencePort.save(existingUser) : existingUser;
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
}