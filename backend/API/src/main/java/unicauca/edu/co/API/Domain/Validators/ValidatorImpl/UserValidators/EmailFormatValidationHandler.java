package unicauca.edu.co.API.Domain.Validators.ValidatorImpl.UserValidators;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.UserValidationHandler;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;

@Component
@Order(3)
public class EmailFormatValidationHandler implements UserValidationHandler {

    @Override
    public void validate(UserCreateDTOIN request) {
        String email = request.getEmail();

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("El correo es obligatorio");
        }

        // Normalización básica
        email = email.trim().toLowerCase();
        request.setEmail(email);

        if (!email.contains("@") || !email.contains(".com")) {      
            throw new IllegalArgumentException("El formato del correo no es válido");
        }
    }
}