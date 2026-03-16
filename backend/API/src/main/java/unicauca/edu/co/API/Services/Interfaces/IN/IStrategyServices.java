package unicauca.edu.co.API.Services.Interfaces.IN;

import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;

public interface IStrategyServices {
    /**
     * Resuelve la estrategia de búsqueda a utilizar según el tipo de consulta y otros factores relevantes.
     * @param query El objeto de consulta que contiene la información necesaria para determinar la estrategia de búsqueda adecuada.
     */
    void resolveSearchStrategy(QueryDTOIN query);

    /**
     * Resuelve la estrategia de web scraping a utilizar según el tipo de consulta y otros factores relevantes.
     * @param query El objeto de consulta que contiene la información necesaria para determinar la estrategia de web scraping adecuada.
     */
    void resolveStrategyWebScraping(QueryDTOIN query, String var_productRef);

    /**
     * Resuelve la estrategia de API a utilizar según el tipo de consulta y otros factores relevantes.
     * @param query
     */
    void resolveStrategyAPI(QueryDTOIN query, String var_productRef);
}
