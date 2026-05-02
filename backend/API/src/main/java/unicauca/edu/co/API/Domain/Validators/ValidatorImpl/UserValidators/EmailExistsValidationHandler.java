package unicauca.edu.co.API.Domain.Validators.ValidatorImpl.UserValidators;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import unicauca.edu.co.API.DataAccess.Adapter.UserPersistenceAdapter;
import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.UserValidationHandler;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;

@Component
@Order(4)
public class EmailExistsValidationHandler implements UserValidationHandler {

    private final UserPersistenceAdapter userPersistenceAdapter;

    public EmailExistsValidationHandler(UserPersistenceAdapter userPersistenceAdapter) {
        this.userPersistenceAdapter = userPersistenceAdapter;
    }

    @Override
    public void validate(UserCreateDTOIN request) {
        if (userPersistenceAdapter.existsByEmailIgnoreCase(request.getEmail())) {
            throw new IllegalArgumentException("El correo ya se encuentra registrado");
        }
    }
}