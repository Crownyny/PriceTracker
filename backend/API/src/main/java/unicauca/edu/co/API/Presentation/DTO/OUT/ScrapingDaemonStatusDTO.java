package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;
import java.util.List;

public record ScrapingDaemonStatusDTO(
    LocalDateTime checkedAt,
    long totalProducts,
    long eligibleProducts,
    long lockedProducts,
    List<ScrapingQueuePreviewItemDTO> nextEligible
) {
}
