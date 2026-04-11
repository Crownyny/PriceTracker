package unicauca.edu.co.API.DataAccess.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio para NormalizedProductEntity.
 * Proporciona operaciones CRUD y consultas personalizadas para productos normalizados.
 */
@Repository
public interface ProductRepository extends JpaRepository<NormalizedProductEntity, String> {

    /**
     * Encuentra productos por referencia.
     */
    List<NormalizedProductEntity> findByProductRef(String productRef);

    /**
     * Encuentra productos por nombre de fuente (tienda).
     */
    List<NormalizedProductEntity> findBySourceName(String sourceName);
    
    /**
     * Encuentra productos por nombre canónico.
     */
    List<NormalizedProductEntity> findByCanonicalName(String canonicalName);
    
    /**
     * Encuentra productos por categoría.
     */
    List<NormalizedProductEntity> findByCategory(String category);
    
    /**
     * Encuentra productos disponibles.
     */
    List<NormalizedProductEntity> findByAvailability(Boolean availability);

    /**
     * Encuentra un producto por referencia y fuente.
     */
    Optional<NormalizedProductEntity> findByProductRefAndSourceName(String productRef, String sourceName);

    /**
     * Encuentra un producto por URL de fuente (clave única del nuevo esquema).
     */
    Optional<NormalizedProductEntity> findBySourceUrl(String sourceUrl);

    /**
     * Encuentra el último producto normalizado por referencia.
     * @param productRef La referencia del producto para la cual se desea encontrar el último producto normalizado.
     * @return Un Optional que contiene el último producto normalizado encontrado, o vacío si no se encontró ninguno.
     */
    Optional<NormalizedProductEntity> findTopByProductRefOrderByUpdatedAtDesc(String productRef);   
    
    /**
     * Cuenta productos por referencia.
     */
    long countByProductRef(String productRef);
    
    /**
     * Cuenta productos por categoría.
     */
    long countByCategory(String category);

    /**
     * Encuentra productos cuya referencia comience con un prefijo dado. Esto es útil para implementar búsquedas por referencia parcial.
     * @param productRef El prefijo de la referencia del producto a buscar.
     * @return Una lista de productos normalizados que coinciden con el prefijo dado.
     */

    List<NormalizedProductEntity> findByProductRefStartingWith(String productRef);
}