package unicauca.edu.co.API.DataAccess.Entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "notification")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEntity {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "alert_id", nullable = false)
    private UUID alertId;

    @Column(name = "listing_id", nullable = false, length = 36)
    private String listingId;

    @Column(name = "triggered_price", nullable = false, precision = 8, scale = 2)
    private BigDecimal triggeredPrice;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    @Column(name = "was_read", nullable = false)
    private Boolean wasRead;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "alert_id", insertable = false, updatable = false)
    private AlertEntity alert;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "listing_id", insertable = false, updatable = false)
    private NormalizedProductEntity listing;

    @PrePersist
    public void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.sentAt == null) {
            this.sentAt = LocalDateTime.now();
        }
        if (this.wasRead == null) {
            this.wasRead = false;
        }
    }
}
