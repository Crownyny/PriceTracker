package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;

public record DaemonTriggerResultDTO(
    String daemon,
    String status,
    LocalDateTime triggeredAt,
    long durationMs,
    String message
) {
}
