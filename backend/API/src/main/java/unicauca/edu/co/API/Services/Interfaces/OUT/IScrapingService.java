package unicauca.edu.co.API.Services.Interfaces.OUT;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;

public interface IScrapingService {
    /**
     * Envía un query de scraping a la cola de RabbitMQ.*
     * Envia status al query de status usando el messengerService
     * @param query el query con los detalles del producto a scrapear
     */
    public void sendData(QueryDTOIN query);
}
