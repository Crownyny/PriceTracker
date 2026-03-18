package unicauca.edu.co.API.Services.Validators.ValidatorImpl;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Validators.InterfacesValidators.AbstractProductValidator;

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
    public void validate(NormalizedProductDTO request) {
        if (request == null) {
            return;
        }
        String text = buildSearchableText(request);
        if (text.isBlank()) {
            next(request);
            return;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String keyword : EXCLUSION_KEYWORDS) {
            if (lower.contains(keyword)) {
                logger.debug("Producto descartado por palabra de exclusión '{}': productRef={}, canonicalName={}",
                    keyword, request.getProductRef(), request.getCanonicalName());
                return;
            }
        }
        next(request);
    }

    private String buildSearchableText(NormalizedProductDTO request) {
        StringBuilder sb = new StringBuilder();
        if (request.getCanonicalName() != null) {
            sb.append(request.getCanonicalName());
        }
        if (request.getDescription() != null) {
            sb.append(" ").append(request.getDescription());
        }
        return sb.toString().trim();
    }
}
