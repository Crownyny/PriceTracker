package unicauca.edu.co.API.DataAccess.Adapter;

import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.DataAccess.Entity.UserEntity;
import unicauca.edu.co.API.DataAccess.Repository.UserRepository;
import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Domain.Model.UserRole;
import unicauca.edu.co.API.Services.Interfaces.OUT.IUserPersistencePort;

@Component
public class UserPersistenceAdapter implements IUserPersistencePort {

    private final UserRepository userRepository;

    public UserPersistenceAdapter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public Optional<User> findById(UUID id) {
        return userRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email).map(this::toDomain);
    }

    @Override
    public Optional<User> findByFirebaseUid(String firebaseUid) {
        return userRepository.findByUUID_firebase(firebaseUid).map(this::toDomain);
    }

    @Override
    public boolean existsByEmailIgnoreCase(String email) {
        return userRepository.existsByEmailIgnoreCase(email);
    }

    @Override
    public User save(User user) {
        UserEntity existingEntity = resolveEntityForSave(user);

        existingEntity.setUUID_firebase(user.getFirebaseUid());
        existingEntity.setEmail(user.getEmail());
        existingEntity.setImageProfile(user.getImageProfile() != null ? user.getImageProfile() : "");
        existingEntity.setRole(toEntityRole(user.getRole()));

        if (user.getCreatedAt() != null) {
            existingEntity.setCreateAt(user.getCreatedAt());
        }
        if (user.getDeletedAt() != null) {
            existingEntity.setDeleteAt(user.getDeletedAt());
        }

        return toDomain(userRepository.save(existingEntity));
    }

    private UserEntity resolveEntityForSave(User user) {
        if (user.getId() == null) {
            return new UserEntity();
        }

        return userRepository.findById(user.getId()).orElseGet(() -> {
            UserEntity entity = new UserEntity();
            entity.setId(user.getId());
            return entity;
        });
    }

    private User toDomain(UserEntity entity) {
        return User.builder()
            .id(entity.getId())
            .firebaseUid(entity.getUUID_firebase())
            .email(entity.getEmail())
            .imageProfile(entity.getImageProfile())
            .role(toDomainRole(entity.getRole()))
            .createdAt(entity.getCreateAt())
            .deletedAt(entity.getDeleteAt())
            .build();
    }

    private UserRole toDomainRole(UserEntity.UserRole role) {
        if (role == null) {
            return null;
        }

        return switch (role) {
            case registered -> UserRole.registered;
            case premium -> UserRole.premium;
        };
    }

    private UserEntity.UserRole toEntityRole(UserRole role) {
        if (role == null) {
            return UserEntity.UserRole.registered;
        }

        return switch (role) {
            case registered -> UserEntity.UserRole.registered;
            case premium -> UserEntity.UserRole.premium;
        };
    }

    @Override
    public Optional<User> delete(UUID id) {
        Optional<UserEntity> entityOpt = userRepository.findById(id);
        if (entityOpt.isEmpty()) {
            return Optional.empty();
        }
        UserEntity entity = entityOpt.get();
        userRepository.delete(entity);
        return Optional.of(toDomain(entity));
     
    }
}
