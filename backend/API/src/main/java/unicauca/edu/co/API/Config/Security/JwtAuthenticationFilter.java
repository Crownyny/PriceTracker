package unicauca.edu.co.API.Config.Security;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import unicauca.edu.co.API.Domain.Model.User;
import unicauca.edu.co.API.Presentation.DTO.OUT.FirebaseTokenDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IAuthService;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final IAuthService authService;
    private final IUserService userService;

    public JwtAuthenticationFilter(IAuthService authService, IUserService userService) {
        this.authService = authService;
        this.userService = userService;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = extractBearerToken(request);
        if (!StringUtils.hasText(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            FirebaseTokenDTO tokenDTO = authService.validateToken(token);
            if (!isTokenValid(tokenDTO)) {
                SecurityContextHolder.clearContext();
                filterChain.doFilter(request, response);
                return;
            }

            User user = userService.findOrCreateUserFromToken(
                tokenDTO.getUid(),
                tokenDTO.getEmail()
            );

            AuthenticatedUserPrincipal principal = new AuthenticatedUserPrincipal(
                user.getId(),
                user.getFirebaseUid(),
                user.getEmail()
            );

            UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                buildAuthorities(user)
            );
            authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authenticationToken);
        } catch (Exception ex) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private String extractBearerToken(HttpServletRequest request) {
        String authorizationHeader = request.getHeader(AUTHORIZATION_HEADER);
        if (!StringUtils.hasText(authorizationHeader) || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            return null;
        }

        String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        return StringUtils.hasText(token) ? token : null;
    }

    private boolean isTokenValid(FirebaseTokenDTO tokenDTO) {
        if (tokenDTO == null) {
            return false;
        }

        if (tokenDTO.getExp() <= Instant.now().getEpochSecond()) {
            return false;
        }

        return hasValidIssuer(tokenDTO.getIss(), tokenDTO.getAud());
    }

    private boolean hasValidIssuer(String issuer, String audience) {
        if (!StringUtils.hasText(issuer) || !StringUtils.hasText(audience)) {
            return false;
        }
        String expectedIssuer = "https://securetoken.google.com/" + audience;
        return expectedIssuer.equals(issuer);
    }

    private List<GrantedAuthority> buildAuthorities(User user) {
        if (user.getRole() == null) {
            return List.of();
        }
        String role = "ROLE_" + user.getRole().name().toUpperCase(Locale.ROOT);
        return List.of(new SimpleGrantedAuthority(role));
    }
}
