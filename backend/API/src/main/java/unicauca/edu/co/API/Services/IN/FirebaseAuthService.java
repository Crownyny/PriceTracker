package unicauca.edu.co.API.Services.IN;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import unicauca.edu.co.API.Presentation.DTO.OUT.FirebaseTokenDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IAuthService;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class FirebaseAuthService implements IAuthService {

    private final ObjectProvider<FirebaseAuth> firebaseAuthProvider;
    private final Cache<String, FirebaseTokenDTO> tokenCache;

    public FirebaseAuthService(ObjectProvider<FirebaseAuth> firebaseAuthProvider) {
        this.firebaseAuthProvider = firebaseAuthProvider;
        // Inicializamos el caché con Caffeine. 
        // Se puede configurar el tiempo de expiración según se requiera.
        this.tokenCache = Caffeine.newBuilder()
                .expireAfterWrite(10, TimeUnit.MINUTES) // El caché expira tras 10 minutos
                .maximumSize(1000) // Tamaño máximo del caché
                .build();
    }

    @Override
    public FirebaseTokenDTO validateToken(String token) throws Exception {
        // Intentar obtener del caché
        FirebaseTokenDTO cachedToken = tokenCache.getIfPresent(token);
        if (cachedToken != null) {
            return cachedToken;
        }

        FirebaseAuth firebaseAuth = firebaseAuthProvider.getObject();

        // Validar con Firebase usando la instancia inyectada
        FirebaseToken decodedToken = firebaseAuth.verifyIdToken(token);
        
        // Extraer los claims solicitados
        FirebaseTokenDTO firebaseTokenDTO = extractTokenInfo(decodedToken);

        // Guardar en caché
        tokenCache.put(token, firebaseTokenDTO);

        return firebaseTokenDTO;
    }

    @Override
    public void invalidateTokenCache(String token) {
        tokenCache.invalidate(token);
    }

    /**
     * Extrae y mapea los claims del FirebaseToken al DTO.
     */
    private FirebaseTokenDTO extractTokenInfo(FirebaseToken decodedToken) {
        Map<String, Object> claims = decodedToken.getClaims();
        
        // Obtener información del provider si existe
        String signInProvider = "";
        if (claims.containsKey("firebase")) {
            Map<?, ?> firebaseClaim = (Map<?, ?>) claims.get("firebase");
            if (firebaseClaim.containsKey("sign_in_provider")) {
                signInProvider = (String) firebaseClaim.get("sign_in_provider");
            }
        }

        return FirebaseTokenDTO.builder()
                .uid(decodedToken.getUid())
                .sub((String) claims.get("sub"))
                .email(decodedToken.getEmail())
                .emailVerified(decodedToken.isEmailVerified())
                .name(decodedToken.getName())
                .picture(decodedToken.getPicture())
                .signInProvider(signInProvider)
                .iat(getClaimAsLong(claims, "iat"))
                .exp(getClaimAsLong(claims, "exp"))
                .iss((String) claims.get("iss"))
                .aud((String) claims.get("aud"))
                .build();
    }

    private long getClaimAsLong(Map<String, Object> claims, String key) {
        Object val = claims.get(key);
        if (val instanceof Number) {
            return ((Number) val).longValue();
        }
        return 0;
    }
}
