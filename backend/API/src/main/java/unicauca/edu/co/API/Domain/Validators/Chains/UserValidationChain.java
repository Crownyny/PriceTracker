package unicauca.edu.co.API.Domain.Validators.Chains;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.UserValidationHandler;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;

import java.util.List;

@Component
public class UserValidationChain {

    private final List<UserValidationHandler> handlers;

    public UserValidationChain(List<UserValidationHandler> handlers) {
        this.handlers = handlers;
    }

    public void validate(UserCreateDTOIN request) {
        for (UserValidationHandler handler : handlers) {
            handler.validate(request); // fail-fast (si uno falla, lanza excepción y se detiene)
        }
    }
}