package unicauca.edu.co.API.Presentation.DTO.IN;

import unicauca.edu.co.API.Domain.Model.UserRole;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO para actualizar el rol de un usuario.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserRoleUpdateDTOIN {
    
    /**
     * Nuevo rol a asignar al usuario
     */
    private UserRole newRole;
}