package unicauca.edu.co.API.Presentation.DTO.IN;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class NotificationDTO {

    private UUID id;
    private UUID alertId;
    private String listingId;
    private BigDecimal triggeredPrice;
    private LocalDateTime sentAt;
    private Boolean wasRead;
    public NotificationDTO() {}
}
