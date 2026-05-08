package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;

public record EmailAlertsStatusDTO(
    LocalDateTime checkedAt,
    long activeAlerts,
    long instantAlerts,
    long dailyAlerts,
    long weeklyAlerts
) {
}
