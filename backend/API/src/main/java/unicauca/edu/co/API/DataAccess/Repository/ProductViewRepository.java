package unicauca.edu.co.API.DataAccess.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import unicauca.edu.co.API.DataAccess.Entity.ProductViewEntity;

/**
 * Repositorio para las vistas de productos.
 * guarda y cuenta cuantos productos han sido vistos por los usuarios
 * en los ultimos 30 dias
 */

@Repository
public interface ProductViewRepository extends JpaRepository<ProductViewEntity,UUID> {

    /**
     * Cuenta el número de vistas de un producto específico en los últimos 30 días.
     */
  
    @Query("""
        SELECT
            p.sourceUrl as sourceUrl,
            COUNT(p) as views
        FROM ProductViewEntity p
        WHERE p.viewedAt >= :startDate
        GROUP BY p.sourceUrl
        ORDER BY COUNT(p) DESC, MAX(p.viewedAt) DESC
    """)
    List<ProductViewStats> findTopViewedProducts(
            @Param("startDate") LocalDateTime startDate,
            Pageable pageable
    );

}