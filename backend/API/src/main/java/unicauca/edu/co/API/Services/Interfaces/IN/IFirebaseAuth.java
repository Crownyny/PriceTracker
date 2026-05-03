package unicauca.edu.co.API.Services.Interfaces.IN;

import com.google.firebase.auth.FirebaseToken;

public interface IFirebaseAuth {
    String createUser(String email, String password);

    void updateUserEmail(String uid, String newEmail);

    void updateUserPassword(String uid, String newPassword);
    
    /**
     * Elimina un usuario de Firebase Authentication.
     */
    void deleteUser(String uid);
    
    /**
     * Verifica y extrae información de un token de Google Firebase.
     * @param idToken Token de ID de Firebase (puede ser de Google, Facebook, etc.)
     * @return FirebaseToken con la información del usuario
     * @throws Exception Si el token es inválido o expirado
     */
    FirebaseToken verifyIdToken(String idToken) throws Exception;
}
