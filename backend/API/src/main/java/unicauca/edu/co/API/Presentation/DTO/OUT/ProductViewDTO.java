package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProductViewDTO {
    private UUID id;
    private String sourceUrl;   
}
