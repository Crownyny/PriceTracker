package unicauca.edu.co.API.DataAccess.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import unicauca.edu.co.API.DataAccess.Entity.ProductSnapShotEntity;


@Repository
public interface ProductSnapShotRepository extends JpaRepository<ProductSnapShotEntity, UUID>{
    /**
     * Listar HistoryEntity por productId
     *  y listar por fecha segun el rango de tiempo de range especificos
     *  1 semana
     *  3 semanas
     *  3 meses
     */
    List<ProductSnapShotEntity> findByProductIdAndUpdatedAtAfter(UUID productId, LocalDateTime date);   

    /**
     * Listar HistoryEntity por productId sin importar la fecha
     * @param productId El ID del producto para el cual se desea obtener el historial de precios.
     * @return Un arreglo de ProductSnapShotEntity que contiene el historial de precios del producto.
     */
    List<ProductSnapShotEntity> findByProductId(UUID productId);
}
