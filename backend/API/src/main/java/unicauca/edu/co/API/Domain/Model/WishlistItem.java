package unicauca.edu.co.API.Domain.Model;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WishlistItem {
    private UUID id;
    private UUID userId;
    private String productId;
    private LocalDateTime createdAt;
}
