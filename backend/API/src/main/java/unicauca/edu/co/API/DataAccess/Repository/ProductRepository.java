package unicauca.edu.co.API.DataAccess.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Sort;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repositorio para NormalizedProductEntity.
 * Proporciona operaciones CRUD y consultas personalizadas para productos normalizados.
 */
@Repository
public interface ProductRepository extends JpaRepository<NormalizedProductEntity, String> {

    /**
     * Encuentra un producto normalizado por su ID.
     * @param id El ID del producto normalizado a buscar.
     * @return El producto normalizado correspondiente al ID proporcionado, o null si no se encuentra.
     */
    Optional<NormalizedProductEntity> findById(String id);
    /**
     * Encuentra productos por referencia.
     */
    Optional<NormalizedProductEntity> findByProductRef(String productRef);
    
    /**
     * Busca productos con filtros opcionales
     */
    @Query("""
    SELECT p
    FROM NormalizedProductEntity p
    WHERE p.productRef = :productRef
    AND p.updatedAt >= :dateTime
    AND (:minPrice IS NULL OR p.price >= :minPrice)
    AND (:maxPrice IS NULL OR p.price <= :maxPrice)
    AND (:sourceName IS NULL OR p.sourceName = :sourceName)
    """)
    List<NormalizedProductEntity> searchProduct(
        @Param("productRef") String productRef,
        @Param("dateTime") LocalDateTime dateTime,
        @Param("minPrice") Double minPrice,
        @Param("maxPrice") Double maxPrice,
        @Param("sourceName") String sourceName,
        Sort sort
    );
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
     * Encuentra el último producto normalizado por URL de fuente, ordenado por fecha de actualización descendente.
     * @param sourceUrl
     * @return
     */
    Optional<NormalizedProductEntity> findFirstBySourceUrlOrderByUpdatedAtDesc(String sourceUrl);

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
         * Cuenta productos elegibles para scraping en el instante indicado.
         */
        @Query("""
                SELECT COUNT(p)
                FROM NormalizedProductEntity p
                WHERE p.nextScrapeAt <= :now
                    AND (p.lockedUntil IS NULL OR p.lockedUntil <= :now)
                """)
        long countEligibleForScraping(@Param("now") LocalDateTime now);

        /**
         * Lista candidatos elegibles ordenados por prioridad del daemon.
         */
        @Query("""
                SELECT p
                FROM NormalizedProductEntity p
                WHERE p.nextScrapeAt <= :now
                    AND (p.lockedUntil IS NULL OR p.lockedUntil <= :now)
                ORDER BY p.alertPriority DESC, p.volatilityScore DESC, p.nextScrapeAt ASC
                """)
        List<NormalizedProductEntity> findEligibleForScraping(@Param("now") LocalDateTime now, Pageable pageable);

        /**
         * Cuenta productos actualmente bloqueados por el daemon.
         */
        long countByLockedUntilAfter(LocalDateTime now);

    /**
     * Encuentra productos cuya referencia comience con un prefijo dado. Esto es útil para implementar búsquedas por referencia parcial.
     * @param productRef El prefijo de la referencia del producto a buscar.
     * @return Una lista de productos normalizados que coinciden con el prefijo dado.
     */

    List<NormalizedProductEntity> findByProductRefStartingWith(String productRef);

}