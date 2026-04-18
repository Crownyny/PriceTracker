package unicauca.edu.co.API.DataAccess.Repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.UserEntity;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);

    @Query("SELECT u FROM UserEntity u WHERE u.UUID_firebase = :username")
    Optional<UserEntity> findByUUID_firebase(@Param("username") String username);
}
