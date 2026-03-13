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
public interface ProductRepository extends JpaRepository<NormalizedProductEntity, Integer> {
    
    /**
     * Encuentra productos por referencia.
     *
     * @param productRef la referencia del producto
     * @return lista de productos con esa referencia
     */
    List<NormalizedProductEntity> findByProductRef(String productRef);
    
    /**
     * Encuentra productos por nombre de fuente (tienda).
     *
     * @param sourceName el nombre de la fuente
     * @return lista de productos de esa fuente
     */
    List<NormalizedProductEntity> findBySourceName(String sourceName);
    
    /**
     * Encuentra productos por nombre canónico.
     *
     * @param canonicalName el nombre canónico del producto
     * @return lista de productos con ese nombre
     */
    List<NormalizedProductEntity> findByCanonicalName(String canonicalName);
    
    /**
     * Encuentra productos por categoría.
     *
     * @param category la categoría del producto
     * @return lista de productos en esa categoría
     */
    List<NormalizedProductEntity> findByCategory(String category);
    
    /**
     * Encuentra productos disponibles.
     *
     * @param availability disponibilidad del producto
     * @return lista de productos según disponibilidad
     */
    List<NormalizedProductEntity> findByAvailability(Boolean availability);
    
    /**
     * Encuentra un producto por referencia y fuente.
     *
     * @param productRef referencia del producto
     * @param sourceName nombre de la fuente
     * @return Optional con el producto si existe
     */
    Optional<NormalizedProductEntity> findByProductRefAndSourceName(String productRef, String sourceName);
    
    /**
     * Cuenta productos por referencia.
     *
     * @param productRef la referencia del producto
     * @return cantidad de productos con esa referencia
     */
    long countByProductRef(String productRef);
    
    /**
     * Cuenta productos por categoría.
     *
     * @param category la categoría
     * @return cantidad de productos en esa categoría
     */
    long countByCategory(String category);
    
    /**
     * Guarda un producto normalizado.
     * Hereda la funcionalidad de JpaRepository.save()
     *
     * @param entity el producto a guardar
     * @return el producto guardado
     */
    @Override
    NormalizedProductEntity save(NormalizedProductEntity entity);
    
    /**
     * Elimina un producto por su ID.
     * Hereda la funcionalidad de JpaRepository.deleteById()
     *
     * @param id el ID del producto a eliminar
     */
    @Override
    void deleteById(Integer id);
    
    /**
     * Elimina un producto específico.
     * Hereda la funcionalidad de JpaRepository.delete()
     *
     * @param entity el producto a eliminar
     */
    @Override
    void delete(NormalizedProductEntity entity);
    
    
    
    /**
     * Encuentra un producto por su ID.
     * Hereda la funcionalidad de JpaRepository.findById()
     *
     * @param id el ID del producto
     * @return Optional con el producto si existe
     */
    @Override
    Optional<NormalizedProductEntity> findById(Integer id);
    
    /**
     * Obtiene todos los productos.
     * Hereda la funcionalidad de JpaRepository.findAll()
     *
     * @return lista de todos los productos
     */
    @Override
    List<NormalizedProductEntity> findAll();
    
    /**
     * Cuenta el total de productos.
     * Hereda la funcionalidad de JpaRepository.count()
     *
     * @return cantidad total de productos
     */
    @Override
    long count();
    
    /**
     * Verifica si un producto existe por su ID.
     * Hereda la funcionalidad de JpaRepository.existsById()
     *
     * @param id el ID del producto
     * @return true si existe, false si no
     */
    @Override
    boolean existsById(Integer id);
}
