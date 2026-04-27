package unicauca.edu.co.API.Presentation.DTO.IN;

import com.google.firebase.database.annotations.NotNull;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.DataAccess.Entity.AlertEntity.AlertFrequency;

@Getter
@Setter
public class AlertRequestDTO {
    @NotNull
    private AlertFrequency frequency;

}
