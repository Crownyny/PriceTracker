package unicauca.edu.co.API.Presentation.DTO.IN;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.Domain.Model.UserRole;

@Getter
@Setter
@AllArgsConstructor
public class UserUpdateDTOIN {
    private UUID id;
    private String uid;
    private String email;
    private String imageProfile;
    private UserRole role;
    private LocalDateTime deleteAt;

    public UserUpdateDTOIN() {
    }
}
