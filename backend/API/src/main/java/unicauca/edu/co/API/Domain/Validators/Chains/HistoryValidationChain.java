package unicauca.edu.co.API.Domain.Validators.Chains;

import org.springframework.stereotype.Component;

import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.IProductValidator;
import unicauca.edu.co.API.Domain.Validators.ValidatorImpl.ProductExistsValidator;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;

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
