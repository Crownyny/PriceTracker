package unicauca.edu.co.API.Services.Validators.ValidatorImpl;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import unicauca.edu.co.API.Config.WebSocketConfig;
import unicauca.edu.co.API.Presentation.DTO.OUT.NormalizedProductDTO;
import unicauca.edu.co.API.Services.Validators.InterfacesValidators.AbstractProductValidator;

/**
 * Compara el título/canonicalName del producto con la consulta del usuario;
 * descarta si la similitud es menor al umbral configurado 
 */
public class SimilarityThresholdValidator extends AbstractProductValidator {

    private static final Logger logger = LoggerFactory.getLogger(SimilarityThresholdValidator.class);

    private final WebSocketConfig webSocketConfig;
    private final double similarityThreshold;

    public SimilarityThresholdValidator(WebSocketConfig webSocketConfig, double similarityThreshold) {
        this.webSocketConfig = webSocketConfig;
        this.similarityThreshold = Math.max(0.0, Math.min(1.0, similarityThreshold));
    }

    @Override
    public void validate(NormalizedProductDTO request) {
        if (request == null) {
            return;
        }
        String searchQuery = webSocketConfig.getSearchQuery(request.getProductRef());
        if (searchQuery == null || searchQuery.isBlank()) {
            logger.info("Similarity: no hay searchQuery guardada para productRef={}, dejando pasar",
                request.getProductRef());
            next(request);
            return;
        }
        String productName = request.getCanonicalName() != null ? request.getCanonicalName() : "";
        double similarity = computeSimilarity(normalizeForComparison(searchQuery), normalizeForComparison(productName));
        if (similarity < similarityThreshold) {
            logger.info("Producto descartado por similitud insuficiente ({} < {}): productRef={}, canonicalName={}",
                String.format("%.2f", similarity), similarityThreshold, request.getProductRef(), request.getCanonicalName());
            return;
        }
        next(request);
    }

    private String normalizeForComparison(String text) {
        if (text == null) return "";
        // Normalizar quitando separadores no alfanuméricos (ej: "iphone-12" -> "iphone 12")
        return text
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^\\p{L}\\p{N}]+", " ")
            .trim()
            .replaceAll("\\s+", " ");
    }

    /**
     * Comparar consulta de usuario con nombre de producto.
     */
    private double computeSimilarity(String query, String product) {
        if (query.isEmpty() || product.isEmpty()) {
            return 0.0;
        }
        Set<String> queryTokens = tokenize(query);
        Set<String> productTokens = tokenize(product);
        // Evitar el Jaccard sobre tokens del producto completo:
        // al comparar contra canonicalName con muchos atributos (apple, 64gb, a14...)
        // la similitud cae demasiado y descarta casi todo con thresholds altos.
        // Aquí usamos cobertura: % de tokens de la consulta que aparecen en el producto.
        if (queryTokens.isEmpty()) return 0.0;

        long intersection = queryTokens.stream().filter(productTokens::contains).count();
        return intersection / (double) queryTokens.size();
    }

    private Set<String> tokenize(String text) {
        return Arrays.stream(text.split("[^\\p{L}\\p{N}]+"))
            .filter(s -> s.length() > 1)
            .collect(Collectors.toSet());
    }
}
