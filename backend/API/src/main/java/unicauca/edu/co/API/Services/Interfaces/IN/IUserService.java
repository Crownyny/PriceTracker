package unicauca.edu.co.API.Services.Interfaces.IN;

import unicauca.edu.co.API.DataAccess.Entity.UserEntity;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import unicauca.edu.co.API.Presentation.DTO.IN.UserUpdateDTOIN;

public interface IUserService {

    UserEntity createUser(UserCreateDTOIN createRequest);

    UserEntity updateUser(UserUpdateDTOIN updateRequest);
}
