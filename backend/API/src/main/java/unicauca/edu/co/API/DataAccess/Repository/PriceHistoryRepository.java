package unicauca.edu.co.API.DataAccess.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.PriceHistoryEntity;

@Repository
public interface PriceHistoryRepository extends JpaRepository<PriceHistoryEntity, Integer> {
    Optional<PriceHistoryEntity> findTopByProductIdOrderByRecordedAtDesc(String productId);

    List<PriceHistoryEntity> findTop2ByProductIdOrderByRecordedAtDesc(String productId);

    Optional<PriceHistoryEntity> findTopByProductIdAndRecordedAtBeforeOrderByRecordedAtDesc(
        String productId,
        LocalDateTime dateTime
    );

    List<PriceHistoryEntity> findByProductIdAndRecordedAtBetweenOrderByRecordedAtAsc(
        String productId,
        LocalDateTime start,
        LocalDateTime end
    );
}
