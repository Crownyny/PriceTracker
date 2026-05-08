package unicauca.edu.co.API.Services.OUT;

import java.util.UUID;

import org.springframework.stereotype.Service;

import unicauca.edu.co.API.DataAccess.Entity.UserEntity;
import unicauca.edu.co.API.DataAccess.Entity.UserEntity.UserRole;
import unicauca.edu.co.API.DataAccess.Repository.UserRepository;
import unicauca.edu.co.API.Presentation.DTO.OUT.UserRoleDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IUserRoleService;

@Service
public class UserRoleService  implements IUserRoleService {

    private final UserRepository userRepository;
    private final IUserService userService;

    public UserRoleService(UserRepository userRepository, IUserService userService) {
        this.userService = userService; 
        this.userRepository = userRepository;
    }

    @Override
    public UserRoleDTO getUserRole() {
        UUID userId = userService.getCurrentUserId();
        UserEntity user = userRepository.getReferenceById(userId);
        if (user == null) {
            throw new RuntimeException("Usuario no encontrado");
        }
        UserRoleDTO userRoleDTO = new UserRoleDTO(user.getRole().name());
        return userRoleDTO;
    }



}
