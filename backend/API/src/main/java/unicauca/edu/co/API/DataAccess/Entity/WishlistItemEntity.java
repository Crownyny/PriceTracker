package unicauca.edu.co.API.DataAccess.Entity;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entidad JPA que mapea la tabla {@code wishlist_item}.
 * <p>
 * Relaciones:
 * <ul>
 *   <li>{@code user_id} → FK a la tabla {@code user}</li>
 *   <li>{@code product_id} → FK a la tabla {@code normalized_products}</li>
 * </ul>
 * Unique constraint: {@code (user_id, product_id)} — un usuario no puede tener
 * el mismo producto repetido en su wishlist.
 */
@Entity
@Table(name = "wishlist_item", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "product_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class WishlistItemEntity {

    @Id
    @NotNull
    @Column(nullable = false, updatable = false)
    private UUID id;

    /** ID del usuario propietario (FK → user.id) */
    @NotNull
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** ID del producto (FK → normalized_products.id) */
    @NotNull
    @NotBlank
    @Column(name = "product_id", nullable = false, length = 36)
    private String productId;

    /** Marca temporal de cuando se agregó a la wishlist */
    @NotNull
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * Asigna valores por defecto antes de persistir por primera vez.
     * Genera UUID y timestamp si no fueron establecidos.
     */
    @PrePersist
    public void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
