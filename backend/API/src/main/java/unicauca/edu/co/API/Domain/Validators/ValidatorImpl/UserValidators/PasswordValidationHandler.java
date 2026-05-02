package unicauca.edu.co.API.Domain.Validators.ValidatorImpl.UserValidators;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.UserValidationHandler;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;

@Component
@Order(2)
public class PasswordValidationHandler implements UserValidationHandler {

    @Override
    public void validate(UserCreateDTOIN request) {
        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres");
        }
    }

}
