package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.DataAccess.Entity.AlertEntity.AlertFrequency;

@Getter
@Setter
public class AlertRequestDTO {
    private AlertFrequency frequency;

}
