package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import unicauca.edu.co.API.DataAccess.Entity.UserEntity.UserRole;


@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserDTO {
    private UUID id;
    private String email;
    private UserRole role;
}
