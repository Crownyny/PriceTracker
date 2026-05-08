package unicauca.edu.co.API.Presentation.DTO.IN;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.DataAccess.Entity.AlertEntity.AlertFrequency;

@Getter
@Setter
@AllArgsConstructor
public class AlertDTO {
    private UUID id;
    private UUID userId;
    private String productId;
    private Boolean isActive;
    private AlertFrequency frequency;
    private LocalDateTime createAt;
    private LocalDateTime deletedAt;
    private List<NotificationDTO> notifications;
    public AlertDTO() {}    
}
