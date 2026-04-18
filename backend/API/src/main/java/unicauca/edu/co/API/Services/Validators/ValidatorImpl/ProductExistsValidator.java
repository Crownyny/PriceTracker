package unicauca.edu.co.API.Services.Validators.ValidatorImpl;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Validators.InterfacesValidators.AbstractProductValidator;

@Component
public class ProductExistsValidator extends AbstractProductValidator {

    private final ProductRepository repository;

    public ProductExistsValidator(ProductRepository repository) {
        this.repository = repository;
    }

    @Override
    public boolean validate(NormalizedProductDTO request) {
        if (!repository.existsById(request.getId())) {
            throw new RuntimeException("El producto no existe");
        }
        return next(request);
    }


}