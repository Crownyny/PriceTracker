package unicauca.edu.co.API.Services.IN;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import unicauca.edu.co.API.Config.Security.AuthenticatedUserPrincipal;
import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Domain.Model.UserRole;
import unicauca.edu.co.API.Presentation.DTO.OUT.FirebaseTokenDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IAuthService;
import unicauca.edu.co.API.Services.Interfaces.IN.IAuthorizationService;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;

@Service
public class AuthorizationService implements IAuthorizationService {

    private static final String BEARER_PREFIX = "Bearer ";

    private static final Map<UserRole, Set<String>> ROLE_PERMISSIONS = Map.of(
        UserRole.registered,
        Set.of(
            "products:search",
            "intent:predict",
            "price-history:read"
        ),
        UserRole.premium,
        Set.of(
            "products:search",
            "intent:predict",
            "price-history:read",
            "alerts:manage",
            "notifications:read"
        )
    );

    private final IAuthService authService;
    private final IUserService userService;

    public AuthorizationService(IAuthService authService, IUserService userService) {
        this.authService = authService;
        this.userService = userService;
    }

    @Override
    public User getAuthenticatedUser(String authorizationHeader) throws Exception {
        String token = extractBearerToken(authorizationHeader);

        FirebaseTokenDTO tokenDTO = authService.validateToken(token);
        validateTokenClaims(tokenDTO);

        return userService.findOrCreateUserFromToken(
            tokenDTO.getUid(),
            tokenDTO.getEmail()
        );
    }

    @Override
    public boolean hasRole(String authorizationHeader, UserRole requiredRole) throws Exception {
        if (requiredRole == null) {
            return false;
        }

        User user = getAuthenticatedUser(authorizationHeader);
        return roleLevel(user.getRole()) >= roleLevel(requiredRole);
    }

    @Override
    public boolean hasAnyRole(String authorizationHeader, Set<UserRole> requiredRoles) throws Exception {
        if (requiredRoles == null || requiredRoles.isEmpty()) {
            return false;
        }

        User user = getAuthenticatedUser(authorizationHeader);
        return requiredRoles.stream().anyMatch(role -> roleLevel(user.getRole()) >= roleLevel(role));
    }

    @Override
    public boolean hasPermission(String authorizationHeader, String permission) throws Exception {
        if (!StringUtils.hasText(permission)) {
            return false;
        }

        User user = getAuthenticatedUser(authorizationHeader);
        Set<String> permissions = ROLE_PERMISSIONS.getOrDefault(user.getRole(), Set.of());
        return permissions.contains(permission.trim().toLowerCase());
    }

    private String extractBearerToken(String authorizationHeader) {
        if (!StringUtils.hasText(authorizationHeader)) {
            throw new IllegalArgumentException("Missing Authorization header");
        }

        if (!authorizationHeader.startsWith(BEARER_PREFIX)) {
            throw new IllegalArgumentException("Invalid Authorization header format. Must start with 'Bearer '");
        }

        String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        if (!StringUtils.hasText(token)) {
            throw new IllegalArgumentException("Bearer token is empty");
        }
        return token;
    }

    private void validateTokenClaims(FirebaseTokenDTO tokenDTO) {
        if (tokenDTO == null) {
            throw new IllegalArgumentException("Token validation failed");
        }

        long now = Instant.now().getEpochSecond();
        if (tokenDTO.getExp() <= now) {
            throw new IllegalArgumentException("Token has expired");
        }

        if (!StringUtils.hasText(tokenDTO.getAud()) || !StringUtils.hasText(tokenDTO.getIss())) {
            throw new IllegalArgumentException("Token is missing issuer/audience claims");
        }

        String expectedIssuer = "https://securetoken.google.com/" + tokenDTO.getAud();
        if (!expectedIssuer.equals(tokenDTO.getIss())) {
            throw new IllegalArgumentException("Token issuer is invalid");
        }

        if (!StringUtils.hasText(tokenDTO.getUid()) && !StringUtils.hasText(tokenDTO.getEmail())) {
            throw new IllegalArgumentException("Token does not contain user identity");
        }
    }

    private int roleLevel(UserRole role) {
        if (role == null) {
            return 0;
        }

        return switch (role) {
            case registered -> 1;
            case premium -> 2;
        };
    }

 
}
