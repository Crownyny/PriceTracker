package unicauca.edu.co.API.Presentation.Mapper;

import org.mapstruct.Mapper;

import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Presentation.DTO.OUT.UserDTO;

@Mapper(componentModel = "spring")
public interface UserMapper extends GenericMapper<User, UserDTO> {
    UserDTO toDTO(User user);
    User toEntity(UserDTO userDTO);
}
