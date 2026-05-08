package unicauca.edu.co.API.Services.Interfaces.OUT;

import java.util.UUID;


import unicauca.edu.co.API.Presentation.DTO.OUT.UserRoleDTO;



public interface IUserRoleService {
    /**
     * Se encarga de obteener el rol actual del usuario loggeado
     * 
     * @return el rol actual del usuario.
     */
    UserRoleDTO getUserRole();
}
