package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import unicauca.edu.co.API.Domain.Model.UserRole;

@Getter
@Setter
@AllArgsConstructor
public class UserCreateDTOIN {
    private String uid;
    private String email;
    private String picture;
    private UserRole role;

    public UserCreateDTOIN() {
    }
}
