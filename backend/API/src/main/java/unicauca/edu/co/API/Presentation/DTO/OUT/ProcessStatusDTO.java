package unicauca.edu.co.API.Presentation.DTO.OUT;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.Presentation.DTO.Enum.ProcessStatus;

@Getter
@Setter
@AllArgsConstructor
public class ProcessStatusDTO {
    private ProcessStatus status;
    public ProcessStatusDTO() {}
}
