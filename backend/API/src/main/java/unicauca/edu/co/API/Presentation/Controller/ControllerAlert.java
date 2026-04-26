package unicauca.edu.co.API.Presentation.Controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity.AlertFrequency;
import unicauca.edu.co.API.Presentation.DTO.IN.AlertDTO;
import unicauca.edu.co.API.Presentation.DTO.IN.AlertRequestDTO;
import unicauca.edu.co.API.Services.IN.AlertService;
import unicauca.edu.co.API.Services.Interfaces.IN.IAlertService;

/**
 * Controlador REST para la gestión de alertas de precios.
 * Proporciona endpoints para crear, consultar, actualizar y eliminar alertas.
 */
@RestController
@RequestMapping("/api/alerts")
public class ControllerAlert {

    private final IAlertService alertService;

    public ControllerAlert(IAlertService alertService) {
        this.alertService = alertService;
    }

    /**
     * Obtiene el userId del usuario autenticado desde el contexto de seguridad.
     * 
     * @return UUID del usuario autenticado
     */
    private UUID getUserIdFromContext() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        // Aquí se obtendría el userId del token JWT o del principal
        // Por ahora, retornamos un UUID de ejemplo
        String userIdStr = authentication.getName();
        try {
            return UUID.fromString(userIdStr);
        } catch (IllegalArgumentException e) {
            // Si el nombre no es un UUID válido, intentar obtenerlo de otra forma
            // En un caso real, deberías tener un mecanismo robusto para obtener el userId
            return UUID.fromString("00000000-0000-0000-0000-000000000000");
        }
    }

    /**
     * Crea una nueva alerta de precio.
     * 
     * @param alertDTO Datos de la alerta a crear
     * @return ResponseEntity con el AlertDTO creado y estado 201 (Created)
     */
    @PostMapping("/{productId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AlertDTO> createAlert( 
        @PathVariable  @NotBlank String productId,
        @Valid @RequestBody AlertRequestDTO frequency) {
        System.out.println(SecurityContextHolder.getContext().getAuthentication());    
        System.out.println(frequency);
        UUID userId = getUserIdFromContext();
        AlertDTO createdAlert = alertService.createAlert(frequency.getFrequency(), productId, userId);
        return new ResponseEntity<>(createdAlert, HttpStatus.CREATED);
    }

    /**
     * Obtiene una alerta por el ID del producto.
     * Valida que la alerta pertenezca al usuario autenticado.
     * 
     * @param productId ID del producto asociado a la alerta
     * @return ResponseEntity con el AlertDTO si existe, estado 200 (OK) o 404 (Not Found)
     */
    @GetMapping("/{productId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AlertDTO> getAlertById(@PathVariable @NotBlank String productId) {
        UUID userId = getUserIdFromContext();
        AlertDTO alert = alertService.getAlertById(productId, userId);
        
        if (alert == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(alert, HttpStatus.OK);
    }

    /**
     * Obtiene todas las alertas activas del usuario autenticado.
     * 
     * @return ResponseEntity con una lista de AlertDTO activos del usuario
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AlertDTO>> getAllAlerts() {
        UUID userId = getUserIdFromContext();
        List<AlertDTO> alerts = alertService.getAllAlerts(userId);
        return new ResponseEntity<>(alerts, HttpStatus.OK);
    }

    /**
     * Actualiza una alerta existente.
     * Valida que la alerta pertenezca al usuario autenticado.
     * 
     * @param productId ID del producto asociado a la alerta
     * @param alertDTO Datos actualizados de la alerta
     * @return ResponseEntity con el AlertDTO actualizado, estado 200 (OK) o 404 (Not Found)
     */
    @PutMapping("/{productId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AlertDTO> updateAlert(
            @PathVariable @NotBlank String productId,
            @RequestBody @Valid AlertDTO alertDTO) {
        UUID userId = getUserIdFromContext();
        AlertDTO updatedAlert = alertService.updateAlert(productId, userId, alertDTO);
        
        if (updatedAlert == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(updatedAlert, HttpStatus.OK);
    }

    /**
     * Actualiza el estado (activa/inactiva) de una alerta.
     * Valida que la alerta pertenezca al usuario autenticado.
     * 
     * @param productId ID del producto asociado a la alerta
     * @param isActive Nuevo estado de la alerta
     * @return ResponseEntity con el AlertDTO actualizado, estado 200 (OK) o 404 (Not Found)
     */
    @PatchMapping("/{productId}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AlertDTO> updateAlertStatus(
            @PathVariable @NotBlank String productId,
            @RequestParam @Valid Boolean isActive) {
        UUID userId = getUserIdFromContext();
        AlertDTO updatedAlert = alertService.updateAlertStatus(productId, userId, isActive);
        
        if (updatedAlert == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(updatedAlert, HttpStatus.OK);
    }

    /**
     * Elimina una alerta (soft delete).
     * Valida que la alerta pertenezca al usuario autenticado.
     * 
     * @param productId ID del producto asociado a la alerta
     * @return ResponseEntity con el AlertDTO eliminado, estado 200 (OK) o 404 (Not Found)
     */
    @DeleteMapping("/{productId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AlertDTO> deleteAlert(@PathVariable @NotBlank String productId) {
        UUID userId = getUserIdFromContext();
        AlertDTO deletedAlert = alertService.deleteAlert(productId, userId);
        
        if (deletedAlert == null) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(deletedAlert, HttpStatus.OK);
    }
}
