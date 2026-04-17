package unicauca.edu.co.API.DataAccess.Repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;

@Repository
public interface AlertRepository extends JpaRepository<AlertEntity, UUID> {
    List<AlertEntity> findByUserId(UUID userId);
    List<AlertEntity> findByProductId(String productId);
    List<AlertEntity> findByIsActiveTrue();
}
