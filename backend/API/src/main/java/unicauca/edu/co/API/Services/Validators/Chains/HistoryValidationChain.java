package unicauca.edu.co.API.Services.Validators.Chains;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Validators.InterfacesValidators.IProductValidator;
import unicauca.edu.co.API.Services.Validators.ValidatorImpl.ProductExistsValidator;

@Component
public class HistoryValidationChain {
    private final IProductValidator chain;

    public HistoryValidationChain(
            ProductExistsValidator exists
    ) {
        this.chain = exists;
    }

    public void validate(NormalizedProductDTO product) {
        chain.validate(product);
    }
}
