package unicauca.edu.co.API.Domain.Model;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    private UUID id;
    private String firebaseUid;
    private String email;
    private String imageProfile;
    private UserRole role;
    private LocalDateTime createdAt;
    private LocalDateTime deletedAt;
}
