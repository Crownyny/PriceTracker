package unicauca.edu.co.API.Services.Interfaces.IN;

public interface IFirebaseAuth {
    String createUser(String email, String password);

    void updateUserEmail(String uid, String newEmail);

    void updateUserPassword(String uid, String newPassword);
    /**
     * Elimina un usuario de Firebase Authentication.
     */
    void deleteUser(String uid);
}
