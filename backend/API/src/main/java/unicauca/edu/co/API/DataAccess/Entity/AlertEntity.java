package unicauca.edu.co.API.DataAccess.Entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "alert")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AlertEntity {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "product_id", nullable = false, length = 36)
    private String productId;

    @Column(name = "target_price", nullable = false, precision = 8, scale = 2)
    private BigDecimal targetPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition", nullable = false)
    private AlertCondition condition;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Enumerated(EnumType.STRING)
    @Column(name = "frequency", nullable = false)
    private AlertFrequency frequency;

    @Column(name = "create_at", nullable = false, updatable = false)
    private LocalDateTime createAt;

    @Column(name = "deleted_at", nullable = false)
    private LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", insertable = false, updatable = false)
    private NormalizedProductEntity product;

    @OneToMany(mappedBy = "alert")
    private List<NotificationEntity> notifications = new ArrayList<>();

    public enum AlertCondition {
        below,
        above,
        any_change
    }

    public enum AlertFrequency {
        instant,
        daily,
        weekly
    }

    @PrePersist
    public void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.createAt == null) {
            this.createAt = LocalDateTime.now();
        }
        if (this.isActive == null) {
            this.isActive = true;
        }
        if (this.deletedAt == null) {
            this.deletedAt = LocalDateTime.now();
        }
    }
}