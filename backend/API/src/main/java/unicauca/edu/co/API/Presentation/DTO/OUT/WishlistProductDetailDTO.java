package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class WishlistProductDetailDTO {
    private UUID id;
    private UUID userId;
    private String productId;
    private LocalDateTime createdAt;
    private NormalizedProductDTO product;
}
