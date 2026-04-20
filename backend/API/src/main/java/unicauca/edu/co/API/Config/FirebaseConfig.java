package unicauca.edu.co.API.Config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Configuration
public class FirebaseConfig {

    @Value("${firebase.config.path:config/firebase-service-account.json}")
    private String configPath;

    @Bean
    @Lazy
    public FirebaseApp firebaseApp() throws IOException {
        System.out.println("[FIREBASE] Initializing FirebaseApp...");
        
        List<FirebaseApp> apps = FirebaseApp.getApps();
        for (FirebaseApp app : apps) {
            if (app.getName().equals(FirebaseApp.DEFAULT_APP_NAME)) {
                System.out.println("[FIREBASE] Default FirebaseApp already exists.");
                return app;
            }
        }

        GoogleCredentials credentials;
        File file = new File(configPath);

        if (file.exists()) {
            System.out.println("[FIREBASE] Loading credentials from: " + file.getAbsolutePath());
            try (InputStream serviceAccount = new FileInputStream(file)) {
                credentials = GoogleCredentials.fromStream(serviceAccount);
            }
        } else {
            System.out.println("[FIREBASE] Config file not found at: " + configPath);
            System.out.println("[FIREBASE] Attempting to use Google Application Default Credentials...");
            credentials = GoogleCredentials.getApplicationDefault();
        }

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(credentials)
                .build();

        FirebaseApp app = FirebaseApp.initializeApp(options);
        System.out.println("[FIREBASE] FirebaseApp initialized successfully.");
        return app;
    }

    @Bean
    @Lazy
    public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        System.out.println("[FIREBASE] Providing FirebaseAuth bean.");
        return FirebaseAuth.getInstance(firebaseApp);
    }
}
