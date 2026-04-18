package unicauca.edu.co.API.Presentation.DTO.IN;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.DataAccess.Entity.UserEntity;

@Getter
@Setter
@AllArgsConstructor
public class UserUpdateDTOIN {
    private UUID id;
    private String uid;
    private String email;
    private String imageProfile;
    private UserEntity.UserRole role;
    private LocalDateTime deleteAt;

    public UserUpdateDTOIN() {
    }
}
