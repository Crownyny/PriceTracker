package unicauca.edu.co.API.Services.Interfaces.IN;

/**
 * Contrato de ejecución del daemon de scraping por producto.
 */
public interface IProductScrapingDaemonService {

    /**
     * Ejecuta un ciclo del daemon: bloquea elegibles y publica jobs en RabbitMQ.
     */
    void dispatchEligibleProducts();
}
