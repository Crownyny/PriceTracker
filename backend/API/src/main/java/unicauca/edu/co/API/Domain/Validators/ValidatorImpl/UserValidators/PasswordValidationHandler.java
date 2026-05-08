package unicauca.edu.co.API.Domain.Validators.ValidatorImpl.UserValidators;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Domain.Model.ErrorType;
import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.UserValidationHandler;
import unicauca.edu.co.API.Exception.BusinessException;
import unicauca.edu.co.API.Presentation.DTO.IN.UserCreateDTOIN;
import java.util.regex.Pattern;

@Component
@Order(2)
public class PasswordValidationHandler implements UserValidationHandler {
    // Al menos:
    // - 8 caracteres
    // - 1 mayúscula
    // - 1 número
    // - 1 símbolo especial
    private static final Pattern PASSWORD_PATTERN = Pattern.compile(
            "^(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&.#_-])[A-Za-z\\d@$!%*?&.#_-]{8,}$"
    );

    @Override
    public void validate(UserCreateDTOIN request) {
        String password = request.getPassword();

        if (password == null || !PASSWORD_PATTERN.matcher(password).matches()) {
            throw new BusinessException(
                    "La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo especial",
                    ErrorType.INVALID_PASSWORD_FORMAT
            );
        }
    }

}
