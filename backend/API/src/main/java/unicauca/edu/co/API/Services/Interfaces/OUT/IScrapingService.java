package unicauca.edu.co.API.Services.Interfaces.OUT;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;

public interface IScrapingService {
    // Método para realizar el scrapping de datos 
    public void sendData(QueryDTOIN query);
}
