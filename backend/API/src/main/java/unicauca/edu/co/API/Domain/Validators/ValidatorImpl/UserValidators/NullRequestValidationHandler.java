package unicauca.edu.co.API.Domain.Validators.ValidatorImpl.UserValidators;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.UserValidationHandler;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;

@Component
@Order(1)
public class NullRequestValidationHandler implements UserValidationHandler {

    @Override
    public void validate(UserCreateDTOIN request) {
        if (request == null) {
            throw new IllegalArgumentException("Los datos del usuario son obligatorios");
        }
    }
}