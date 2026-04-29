package unicauca.edu.co.API;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import unicauca.edu.co.API.DataAccess.Adapter.ProductScrapingQueueAdapter;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.Domain.Model.ScrapingJobMessage;
import unicauca.edu.co.API.Services.IN.ProductScrapingDaemonService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IScrapingService;

@Transactional
@SpringBootTest(classes = ScenarioTestApplication.class)
@Import({ProductScrapingDaemonService.class, ProductScrapingQueueAdapter.class})
@TestPropertySource(properties = {
    "scraping.daemon.enabled=true",
    "scraping.daemon.capacity=2",
    "scraping.daemon.lock-minutes=15"
})
class ProductScrapingDaemonScenariosTest extends PostgresScenarioTestBase {

    @Autowired
    private ProductScrapingDaemonService daemonService;

    @Autowired
    private ProductRepository productRepository;

    @MockitoBean
    private IScrapingService scrapingService;

    @BeforeEach
    void setUp() {
        reset(scrapingService);
        productRepository.deleteAll();
    }

    @Test
    void shouldProcessOnlyEligibleAndUnlockedProducts() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        productRepository.save(buildProduct("p-eligible", "ref-eligible", 2, 1.0, now.minusMinutes(10), null));
        productRepository.save(buildProduct("p-future", "ref-future", 3, 5.0, now.plusMinutes(20), null));
        productRepository.save(buildProduct("p-locked", "ref-locked", 3, 8.0, now.minusMinutes(20), now.plusMinutes(10)));

        daemonService.dispatchEligibleProducts();

        ArgumentCaptor<ScrapingJobMessage> captor = ArgumentCaptor.forClass(ScrapingJobMessage.class);
        verify(scrapingService, times(1)).sendScrapingJob(captor.capture());
        assertThat(captor.getValue().productRef()).isEqualTo("ref-eligible");
    }

    @Test
    void shouldRespectPriorityAndCapacityOrder() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        productRepository.save(buildProduct("p-a", "ref-a", 3, 1.0, now.minusMinutes(6), null));
        productRepository.save(buildProduct("p-b", "ref-b", 3, 9.0, now.minusMinutes(5), null));
        productRepository.save(buildProduct("p-c", "ref-c", 2, 9.0, now.minusMinutes(50), null));

        daemonService.dispatchEligibleProducts();

        ArgumentCaptor<ScrapingJobMessage> captor = ArgumentCaptor.forClass(ScrapingJobMessage.class);
        verify(scrapingService, times(2)).sendScrapingJob(captor.capture());

        assertThat(captor.getAllValues())
            .extracting(ScrapingJobMessage::productRef)
            .containsExactly("ref-b", "ref-a");
    }

    @Test
    void shouldReleaseLockWhenPublishFails() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        NormalizedProductEntity failingProduct = buildProduct(
            "p-fail",
            "ref-fail",
            3,
            7.0,
            now.minusMinutes(20),
            null
        );
        productRepository.saveAndFlush(failingProduct);

        doThrow(new RuntimeException("broker down")).when(scrapingService).sendScrapingJob(any(ScrapingJobMessage.class));

        daemonService.dispatchEligibleProducts();

        NormalizedProductEntity refreshed = productRepository.findById("p-fail").orElseThrow();
        assertThat(refreshed.getLockedUntil()).isNull();
    }

    private NormalizedProductEntity buildProduct(
        String id,
        String productRef,
        int alertPriority,
        double volatility,
        LocalDateTime nextScrapeAt,
        LocalDateTime lockedUntil
    ) {
        NormalizedProductEntity product = new NormalizedProductEntity();
        product.setId(id);
        product.setProductRef(productRef);
        product.setSourceName("test-store");
        product.setSourceUrl("https://example.com/" + id);
        product.setCanonicalName("Product " + id);
        product.setPrice(100.0);
        product.setCurrency("COP");
        product.setCategory("test-category");
        product.setAvailability(true);
        product.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));
        product.setLastScrapedAt(null);
        product.setNextScrapeAt(nextScrapeAt);
        product.setVolatilityScore(volatility);
        product.setAlertPriority(alertPriority);
        product.setLockedUntil(lockedUntil);
        product.setImageUrl("");
        product.setDescription("test");
        product.setExtra(Map.of());
        return product;
    }
}
