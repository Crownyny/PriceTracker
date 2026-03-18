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
            next(request);
            return;
        }
        String productName = request.getCanonicalName() != null ? request.getCanonicalName() : "";
        double similarity = computeSimilarity(normalizeForComparison(searchQuery), normalizeForComparison(productName));
        if (similarity < similarityThreshold) {
            logger.debug("Producto descartado por similitud insuficiente ({} < {}): productRef={}, canonicalName={}",
                String.format("%.2f", similarity), similarityThreshold, request.getProductRef(), request.getCanonicalName());
            return;
        }
        next(request);
    }

    private String normalizeForComparison(String text) {
        if (text == null) return "";
        return text.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
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
        if (queryTokens.isEmpty()) return 1.0;
        long intersection = queryTokens.stream().filter(productTokens::contains).count();
        int union = queryTokens.size() + productTokens.size() - (int) intersection;
        if (union == 0) return 1.0;
        return (double) intersection / union;
    }

    private Set<String> tokenize(String text) {
        return Arrays.stream(text.split("\\s+"))
            .filter(s -> s.length() > 1)
            .collect(Collectors.toSet());
    }
}
