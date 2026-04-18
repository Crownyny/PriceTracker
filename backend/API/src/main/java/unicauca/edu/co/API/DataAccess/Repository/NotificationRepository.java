package unicauca.edu.co.API.DataAccess.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.NotificationEntity;

@Repository
public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {
    List<NotificationEntity> findByAlertId(UUID alertId);
    List<NotificationEntity> findByListingId(String listingId);
    Optional<NotificationEntity> findTopByAlertIdOrderBySentAtDesc(UUID alertId);
    boolean existsByAlertIdAndSentAtBetween(UUID alertId, LocalDateTime start, LocalDateTime end);
}
