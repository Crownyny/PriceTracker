package unicauca.edu.co.API.Domain.Validators.InterfacesValidators;

import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;

public interface UserValidationHandler {
    void validate(UserCreateDTOIN request);
}