package unicauca.edu.co.API.Services.IN;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import unicauca.edu.co.API.DataAccess.Entity.UserEntity;
import unicauca.edu.co.API.DataAccess.Repository.UserRepository;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserUpdateDTOIN;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;

@Service
@Transactional
public class UserService implements IUserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserEntity createUser(UserCreateDTOIN createRequest) {
        if (createRequest == null) {
            throw new IllegalArgumentException("Los datos del usuario son obligatorios");
        }

        String normalizedUid = normalizeAndValidateUid(createRequest.getUid());
        String normalizedEmail = normalizeAndValidateEmail(createRequest.getEmail());

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("El correo ya se encuentra registrado");
        }

        if (userRepository.findByUUID_firebase(normalizedUid).isPresent()) {
            throw new IllegalArgumentException("El uid de Firebase ya se encuentra registrado");
        }

        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setUUID_firebase(normalizedUid);
        user.setEmail(normalizedEmail);
        user.setImageProfile(hasText(createRequest.getPicture()) ? createRequest.getPicture().trim() : "");
        user.setRole(createRequest.getRole() != null ? createRequest.getRole() : UserEntity.UserRole.registered);
        user.setCreateAt(LocalDateTime.now());

        return userRepository.save(user);
    }

    @Override
    public UserEntity updateUser(UserUpdateDTOIN updateRequest) {
        if (updateRequest == null) {
            throw new IllegalArgumentException("Los datos del usuario son obligatorios");
        }

        UUID id = updateRequest.getId();
        if (id == null) {
            throw new IllegalArgumentException("El id del usuario es obligatorio");
        }

        UserEntity existingUser = userRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (updateRequest.getUid() != null) {
            String normalizedUid = normalizeAndValidateUid(updateRequest.getUid());

            boolean uidBelongsToAnotherUser = userRepository.findByUUID_firebase(normalizedUid)
                .map(user -> !user.getId().equals(existingUser.getId()))
                .orElse(false);

            if (uidBelongsToAnotherUser) {
                throw new IllegalArgumentException("El uid de Firebase ya se encuentra registrado");
            }

            existingUser.setUUID_firebase(normalizedUid);
        }

        if (updateRequest.getEmail() != null) {
            String normalizedEmail = normalizeAndValidateEmail(updateRequest.getEmail());

            boolean emailBelongsToAnotherUser = userRepository.existsByEmailIgnoreCase(normalizedEmail)
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
            existingUser.setDeleteAt(updateRequest.getDeleteAt());
        }

        return userRepository.save(existingUser);
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

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}