package unicauca.edu.co.API.Config.Security;

import java.util.UUID;

public record AuthenticatedUserPrincipal(UUID id, String firebaseUid, String email) {
}
