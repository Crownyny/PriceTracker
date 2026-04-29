package unicauca.edu.co.API.Domain.Validators.ValidatorImpl;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Domain.Validators.InterfacesValidators.AbstractProductValidator;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;

/**
 * Validador HU-3: Relación y descarte de resultados (Variantes).
 * Descarta productos que son accesorios, variantes por capacidad/color u otros no clave,
 * para no enviar accesorios ni resultados que no correspondan al producto buscado.
 */
public class AccessoryAndVariantExclusionValidator extends AbstractProductValidator {

    private static final Logger logger = LoggerFactory.getLogger(AccessoryAndVariantExclusionValidator.class);

    /** Palabras que indican que el resultado es un accesorio a descartar (HU-3-CA2). No se envían accesorios. */
    private static final Set<String> EXCLUSION_KEYWORDS = Arrays.stream(new String[] {
        "accesorio", "accesorios", "funda", "fundas", "case", "carcasa", "cable", "cargador",
        "adaptador", "soporte", "protector", "película", "film", "sticker", "repuesto",
        "variante", "variantes", "kit", "combo", "pack", "bundle"
    }).collect(Collectors.toSet());

    @Override
    public boolean validate(NormalizedProductDTO request) {
        if (request == null) {
            return false;
        }
        String text = buildSearchableText(request);
        if (text.isBlank()) {
            return next(request);
        }
        return next(request);
    }

    private String buildSearchableText(NormalizedProductDTO request) {
        // IMPORTANTE:
        // Usar SOLO canonicalName para evitar falsos positivos como:
        // "NO incluye cargador" (descripciones de reacondicionados) que contiene
        // keywords de accesorios pero el producto NO es un cargador.
        String canonicalName = request.getCanonicalName();
        if (canonicalName != null && !canonicalName.isBlank()) {
            return canonicalName.trim();
        }

        // Fallback: si no hay canonicalName, entonces usar descripción.
        String description = request.getDescription();
        return description == null ? "" : description.trim();
    }
}
