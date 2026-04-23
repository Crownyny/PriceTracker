package unicauca.edu.co.API.Services.Interfaces.IN;

import java.util.List;
import java.util.UUID;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity.AlertFrequency;
import unicauca.edu.co.API.Presentation.DTO.IN.AlertDTO;

public interface IAlertService {
    /**
     * Crea una nueva alerta para un producto específico. El usuario debe estar autenticado para crear una alerta.
     * @param frequency La frecuencia con la que se desea recibir notificaciones de la alerta
     * @param productId El ID del producto para el cual se desea crear la alerta
      * @param userId El ID del usuario que intenta crear la alerta
     * @return El AlertDTO creado 
     */
    AlertDTO createAlert(AlertFrequency frequency, String productId, UUID userId);
    /**
     * Obtiene una alerta por su ID. El usuario debe estar autenticado para obtener una alerta.
     * @param productId El ID del producto asociado a la alerta a obtener
     * @return El AlertDTO correspondiente al ID proporcionado, o null si no se encuentra la alerta
     */
    AlertDTO getAlertById(String productId, UUID userID);
    /**
     * Actualiza una alerta existente para un producto específico. El usuario debe estar autenticado para actualizar una alerta.
     * @param productId El ID del producto asociado a la alerta a actualizar
     * @param alertDTO Un objeto AlertDTO que contiene la información actualizada de la alerta
     * @param userId El ID del usuario que intenta actualizar la alerta
     * @return El AlertDTO actualizado, o null si no se encuentra la alerta a actualizar
     */
    AlertDTO updateAlert(String productId, UUID userId, AlertDTO alertDTO);

    /**
     * Actualiza el estado de una alerta existente para un producto específico. El usuario debe estar autenticado para actualizar el estado de una alerta.
     * @param productId El ID del producto asociado a la alerta a actualizar
     * @param isActive El nuevo estado de la alerta
     * @param userId El ID del usuario que intenta actualizar el estado de la alerta
     * @return El AlertDTO actualizado, o null si no se encuentra la alerta a actualizar
     */
    AlertDTO updateAlertStatus(String productId, UUID userId,  Boolean isActive);
    /**
     * Elimina una alerta por su ID. El usuario debe estar autenticado para eliminar una alerta.
     * @param productId El ID del producto asociado a la alerta a eliminar
     * @return El AlertDTO eliminado, o null si no se encuentra la alerta a eliminar
     */
    AlertDTO deleteAlert(String productId, UUID userId);
    /**
     * Obtiene todas las alertas existentes. El usuario debe estar autenticado para obtener las alertas.
     * @return Lista de alertas existentes, o una lista vacía si no se encuentran alertas
     */
    List<AlertDTO> getAllAlerts(UUID userId);
}
