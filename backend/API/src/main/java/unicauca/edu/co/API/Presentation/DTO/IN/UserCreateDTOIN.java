package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.DataAccess.Entity.UserEntity;

@Getter
@Setter
@AllArgsConstructor
public class UserCreateDTOIN {
    private String uid;
    private String email;
    private String picture;
    private UserEntity.UserRole role;

    public UserCreateDTOIN() {
    }
}
