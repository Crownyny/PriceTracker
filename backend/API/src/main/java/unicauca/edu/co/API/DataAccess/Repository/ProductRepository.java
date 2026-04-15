package unicauca.edu.co.API.DataAccess.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio para NormalizedProductEntity.
 * Proporciona operaciones CRUD y consultas personalizadas para productos normalizados.
 */
@Repository
public interface ProductRepository extends JpaRepository<NormalizedProductEntity, Integer> {

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
     * Encuentra productos recientes por referencia y fecha.
     * @param productRef La referencia del producto para la cual se desea encontrar productos recientes.
     * @param dateTime La fecha y hora a partir de la cual se consideran los productos como recientes. Solo se devolverán productos que hayan sido actualizados después de esta fecha y hora.
     * @return Una lista de productos normalizados que coinciden con los criterios de búsqueda.
     */
    @Query("SELECT p FROM NormalizedProductEntity p " +
       "WHERE p.productRef = :productRef " +
       "AND p.updatedAt >= :dateTime")
    List<NormalizedProductEntity> findRecentProducts(
        @Param("productRef") String productRef,
        @Param("dateTime") LocalDateTime dateTime
    );

    /**
     * Encuentra productos cuya referencia comience con un prefijo dado. Esto es útil para implementar búsquedas por referencia parcial.
     * @param productRef El prefijo de la referencia del producto a buscar.
     * @return Una lista de productos normalizados que coinciden con el prefijo dado.
     */

    List<NormalizedProductEntity> findByProductRefStartingWith(String productRef);
}