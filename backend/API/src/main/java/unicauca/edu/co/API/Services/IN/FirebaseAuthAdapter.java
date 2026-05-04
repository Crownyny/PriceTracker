package unicauca.edu.co.API.Services.IN;

import com.google.firebase.auth.*;
import org.springframework.stereotype.Service;
import unicauca.edu.co.API.Services.Interfaces.IN.IFirebaseAuth;

@Service
public class FirebaseAuthAdapter implements IFirebaseAuth {

    @Override
    public String createUser(String email, String password) {
        try {
            UserRecord.CreateRequest request = new UserRecord.CreateRequest()
                    .setEmail(email)
                    .setPassword(password);

            return FirebaseAuth.getInstance().createUser(request).getUid();

        } catch (FirebaseAuthException e) {
            handleException(e);
            return null;
        }
    }

    @Override
    public void updateUserEmail(String uid, String newEmail) {
        try {
            UserRecord.UpdateRequest request = new UserRecord.UpdateRequest(uid)
                    .setEmail(newEmail);

            FirebaseAuth.getInstance().updateUser(request);

        } catch (FirebaseAuthException e) {
            handleException(e);
        }
    }

    @Override
    public void updateUserPassword(String uid, String newPassword) {
        try {
            UserRecord.UpdateRequest request = new UserRecord.UpdateRequest(uid)
                    .setPassword(newPassword);

            FirebaseAuth.getInstance().updateUser(request);

        } catch (FirebaseAuthException e) {
            handleException(e);
        }
    }

    @Override
    public void deleteUser(String uid) {
        try {
            FirebaseAuth.getInstance().deleteUser(uid);

        } catch (FirebaseAuthException e) {
            handleException(e);
        }
    }

    @Override
    public FirebaseToken verifyIdToken(String idToken) throws FirebaseAuthException {
        return FirebaseAuth.getInstance().verifyIdToken(idToken);
    }

    private void handleException(FirebaseAuthException e) {
        if (e.getAuthErrorCode() == AuthErrorCode.EMAIL_ALREADY_EXISTS) {
            throw new IllegalArgumentException("El correo ya está registrado en Firebase");
        }
        if (e.getAuthErrorCode() == AuthErrorCode.USER_NOT_FOUND) {
            throw new IllegalArgumentException("Usuario no encontrado en Firebase");
        }
        throw new RuntimeException("Error en Firebase", e);
    }
}