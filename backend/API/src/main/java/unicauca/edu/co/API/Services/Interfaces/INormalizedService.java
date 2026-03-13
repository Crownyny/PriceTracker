package unicauca.edu.co.API.Services.Interfaces;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;

public interface INormalizedService {
    NormalizedProductDTO listenToResults(NormalizedProductEntity message);
}
