package unicauca.edu.co.API.Services.Interfaces.IN;

import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserUpdateDTOIN;

public interface IUserService {

    User createUser(UserCreateDTOIN createRequest);

    User updateUser(UserUpdateDTOIN updateRequest);

    User findOrCreateUserFromToken(String uid, String email, String picture);
}
