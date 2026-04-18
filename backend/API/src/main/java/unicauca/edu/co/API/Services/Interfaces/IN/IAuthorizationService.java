package unicauca.edu.co.API.Services.Interfaces.IN;

import java.util.Set;

import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Domain.Model.UserRole;

public interface IAuthorizationService {

    User getAuthenticatedUser(String authorizationHeader) throws Exception;

    boolean hasRole(String authorizationHeader, UserRole requiredRole) throws Exception;

    boolean hasAnyRole(String authorizationHeader, Set<UserRole> requiredRoles) throws Exception;

    boolean hasPermission(String authorizationHeader, String permission) throws Exception;
}
