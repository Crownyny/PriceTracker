package unicauca.edu.co.API;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;
import unicauca.edu.co.API.DataAccess.Entity.NotificationEntity;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Entity.PriceHistoryEntity;
import unicauca.edu.co.API.DataAccess.Entity.UserEntity;
import unicauca.edu.co.API.DataAccess.Repository.AlertRepository;
import unicauca.edu.co.API.DataAccess.Repository.NotificationRepository;
import unicauca.edu.co.API.DataAccess.Repository.PriceHistoryRepository;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.DataAccess.Repository.UserRepository;
import unicauca.edu.co.API.Services.IN.Email.EmailNotificationDaemon;
import unicauca.edu.co.API.Services.Interfaces.IN.IEmailNotificationService;

@Transactional
@SpringBootTest(classes = ScenarioTestApplication.class)
@Import(EmailNotificationDaemon.class)
@TestPropertySource(properties = {
    "mail.notifications.enabled=true",
    "mail.notifications.timezone=UTC"
})
class EmailNotificationDaemonScenariosTest extends PostgresScenarioTestBase {

    @Autowired
    private EmailNotificationDaemon emailNotificationDaemon;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private PriceHistoryRepository priceHistoryRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @MockitoBean
    private IEmailNotificationService emailNotificationService;

    @BeforeEach
    void setUp() {
        reset(emailNotificationService);
        notificationRepository.deleteAll();
        alertRepository.deleteAll();
        priceHistoryRepository.deleteAll();
        productRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void shouldSendInstantAnyChangeAndPersistNotification() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0);

        UserEntity user = saveUser("user1@test.com");
        NormalizedProductEntity product = saveProduct("prod-1", "ref-1");
        AlertEntity alert = saveAlert(user.getId(), product.getId(), AlertEntity.AlertCondition.any_change, BigDecimal.valueOf(9999));

        savePriceHistory(product, 100.0, now.minusMinutes(10), "job-old");
        savePriceHistory(product, 95.0, now.minusMinutes(5), "job-new");

        emailNotificationDaemon.validateAndSendEmailNotifications();

        verify(emailNotificationService, times(1)).sendNotification(argThat(request ->
            request.userId().equals(user.getId())
                && request.recipientEmail().equals(user.getEmail())
                && request.products().size() == 1
                && request.products().get(0).productId().equals(product.getId())
        ));

        assertThat(notificationRepository.findByAlertId(alert.getId())).hasSize(1);
        assertThat(notificationRepository.findByAlertId(alert.getId()).get(0).getTriggeredPrice())
            .isEqualByComparingTo(BigDecimal.valueOf(95.0));
    }

    @Test
    void shouldNotSendInstantIfAlreadyNotifiedAfterLatestPrice() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0);

        UserEntity user = saveUser("user2@test.com");
        NormalizedProductEntity product = saveProduct("prod-2", "ref-2");
        AlertEntity alert = saveAlert(user.getId(), product.getId(), AlertEntity.AlertCondition.any_change, BigDecimal.valueOf(9999));

        savePriceHistory(product, 100.0, now.minusMinutes(12), "job-old");
        savePriceHistory(product, 90.0, now.minusMinutes(6), "job-new");

        NotificationEntity previous = new NotificationEntity();
        previous.setAlertId(alert.getId());
        previous.setListingId(product.getId());
        previous.setTriggeredPrice(BigDecimal.valueOf(90.0));
        previous.setSentAt(now.minusMinutes(1));
        previous.setWasRead(false);
        notificationRepository.save(previous);

        emailNotificationDaemon.validateAndSendEmailNotifications();

        verifyNoInteractions(emailNotificationService);
        assertThat(notificationRepository.findByAlertId(alert.getId())).hasSize(1);
    }

    @Test
    void shouldNotSendWhenBelowConditionIsNotMet() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0);

        UserEntity user = saveUser("user3@test.com");
        NormalizedProductEntity product = saveProduct("prod-3", "ref-3");
        saveAlert(user.getId(), product.getId(), AlertEntity.AlertCondition.below, BigDecimal.valueOf(90.0));

        savePriceHistory(product, 100.0, now.minusMinutes(10), "job-old");
        savePriceHistory(product, 95.0, now.minusMinutes(2), "job-new");

        emailNotificationDaemon.validateAndSendEmailNotifications();

        verifyNoInteractions(emailNotificationService);
        assertThat(notificationRepository.count()).isZero();
    }

    private UserEntity saveUser(String email) {
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setUUID_firebase("firebase-" + user.getId());
        user.setEmail(email);
        user.setImageProfile("");
        user.setRole(UserEntity.UserRole.registered);
        user.setCreateAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));
        user.setDeleteAt(null);
        return userRepository.save(user);
    }

    private NormalizedProductEntity saveProduct(String productId, String productRef) {
        NormalizedProductEntity product = new NormalizedProductEntity();
        product.setId(productId);
        product.setProductRef(productRef);
        product.setSourceName("store");
        product.setSourceUrl("https://example.com/" + productId);
        product.setCanonicalName("Product " + productId);
        product.setPrice(120.0);
        product.setCurrency("COP");
        product.setCategory("cat");
        product.setAvailability(true);
        product.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));
        product.setLastScrapedAt(null);
        product.setNextScrapeAt(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(1));
        product.setVolatilityScore(0.0);
        product.setAlertPriority(0);
        product.setLockedUntil(null);
        product.setImageUrl("");
        product.setDescription("desc");
        product.setExtra(Map.of());
        return productRepository.save(product);
    }

    private AlertEntity saveAlert(UUID userId, String productId, AlertEntity.AlertCondition condition, BigDecimal targetPrice) {
        AlertEntity alert = new AlertEntity();
        alert.setId(UUID.randomUUID());
        alert.setUserId(userId);
        alert.setProductId(productId);
        alert.setIsActive(true);
        alert.setFrequency(AlertEntity.AlertFrequency.instant);
        alert.setCreateAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));
        alert.setDeletedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));
        return alertRepository.save(alert);
    }

    private void savePriceHistory(NormalizedProductEntity product, double price, LocalDateTime recordedAt, String jobId) {
        PriceHistoryEntity history = new PriceHistoryEntity();
        history.setProductId(product.getId());
        history.setPrice(price);
        history.setCurrency(product.getCurrency());
        history.setRecordedAt(recordedAt);
        history.setJobId(jobId);
        priceHistoryRepository.save(history);
    }
}
