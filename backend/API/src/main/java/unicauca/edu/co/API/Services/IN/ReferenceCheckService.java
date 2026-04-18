package unicauca.edu.co.API.Services.IN;

import org.springframework.stereotype.Service;

import unicauca.edu.co.API.DataAccess.Repository.ProductRefCacheRepository;
import unicauca.edu.co.API.Services.Interfaces.IN.IReferenceCheckService;

@Service
public class ReferenceCheckService implements IReferenceCheckService {

    private final ProductRefCacheRepository productRefCacheRepository;
    public ReferenceCheckService(
        ProductRefCacheRepository productRefCacheRepository
    ) {
        this.productRefCacheRepository = productRefCacheRepository;
    }

    @Override
    public  Boolean checkReferenceExists(String productRef) {
        if (productRefCacheRepository.exists(productRef)) {
            return true;
        }
        return false;
    }

    public boolean save(String productRef) {
        try {
            productRefCacheRepository.save(productRef);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

}
