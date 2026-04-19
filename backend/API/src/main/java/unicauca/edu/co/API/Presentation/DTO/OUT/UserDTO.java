package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.DataAccess.Entity.UserEntity.UserRole;
import unicauca.edu.co.API.Presentation.DTO.IN.AlertDTO;

@Getter
@Setter
@AllArgsConstructor
public class UserDTO {
    private UUID id;
    private String UUID_firebase;
    private String email;
    private String imageProfile;
    private UserRole role;
    private LocalDateTime createAt;
    private LocalDateTime deleteAt;
    private List<AlertDTO> alerts;
    public UserDTO() {}

}
