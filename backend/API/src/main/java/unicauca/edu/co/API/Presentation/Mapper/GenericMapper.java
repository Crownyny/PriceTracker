package unicauca.edu.co.API.Presentation.Mapper;

/**
 * Interfaz genérica para mappers.
 * Define los métodos estándar para convertir entre entidades y DTOs.
 *
 * @param <E> Tipo de la entidad
 * @param <D> Tipo del DTO
 */
public interface GenericMapper<E, D> {

    /**
     * Convierte una entidad a DTO.
     *
     * @param entity la entidad a convertir
     * @return el DTO correspondiente
     */
    D toDTO(E entity);

    /**
     * Convierte un DTO a entidad.
     *
     * @param dto el DTO a convertir
     * @return la entidad correspondiente
     */
    E toEntity(D dto);
}
