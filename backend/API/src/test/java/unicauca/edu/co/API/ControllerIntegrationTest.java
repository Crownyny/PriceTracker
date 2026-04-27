package unicauca.edu.co.API;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Repository.AlertRepository;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.Presentation.Controller.AdminDaemonTestController;
import unicauca.edu.co.API.Services.Interfaces.IN.IAuthService;
import unicauca.edu.co.API.Services.Interfaces.IN.IUserService;
import unicauca.edu.co.API.Services.IN.Email.EmailNotificationDaemon;
import unicauca.edu.co.API.Services.IN.ProductScrapingDaemonService;

@WebMvcTest(controllers = AdminDaemonTestController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
class ControllerIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private ProductScrapingDaemonService productScrapingDaemonService;

	@MockitoBean
	private EmailNotificationDaemon emailNotificationDaemon;

	@MockitoBean
	private ProductRepository productRepository;

	@MockitoBean
	private AlertRepository alertRepository;

	@MockitoBean
	private IAuthService authService;

	@MockitoBean
	private IUserService userService;

	@Test
	void triggerScrapingEndpointShouldReturnOk() throws Exception {
		doNothing().when(productScrapingDaemonService).dispatchEligibleProducts();

		mockMvc.perform(post("/api/internal/test/scraping/trigger"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.daemon").value("scraping"))
			.andExpect(jsonPath("$.status").value("ok"));
	}

	@Test
	void scrapingStatusShouldReturnCountsAndPreview() throws Exception {
		NormalizedProductEntity product = new NormalizedProductEntity();
		product.setId("p-1");
		product.setProductRef("ref-1");
		product.setCanonicalName("Producto test");
		product.setSourceName("store-a");
		product.setSourceUrl("https://example.com/p1");
		product.setAlertPriority(3);
		product.setVolatilityScore(5.0);
		product.setNextScrapeAt(LocalDateTime.now().minusMinutes(1));

		when(productRepository.count()).thenReturn(100L);
		when(productRepository.countEligibleForScraping(org.mockito.ArgumentMatchers.any(LocalDateTime.class))).thenReturn(12L);
		when(productRepository.countByLockedUntilAfter(org.mockito.ArgumentMatchers.any(LocalDateTime.class))).thenReturn(2L);
		when(productRepository.findEligibleForScraping(
			org.mockito.ArgumentMatchers.any(LocalDateTime.class),
			org.mockito.ArgumentMatchers.any(org.springframework.data.domain.Pageable.class)
		)).thenReturn(List.of(product));

		mockMvc.perform(get("/api/internal/test/scraping/status").param("limit", "10"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.totalProducts").value(100))
			.andExpect(jsonPath("$.eligibleProducts").value(12))
			.andExpect(jsonPath("$.lockedProducts").value(2))
			.andExpect(jsonPath("$.nextEligible[0].id").value("p-1"));
	}

	@Test
	void emailAlertsStatusShouldReturnFrequencyCounts() throws Exception {
		when(alertRepository.countByIsActiveTrue()).thenReturn(9L);
		when(alertRepository.countByIsActiveTrueAndFrequency(AlertEntity.AlertFrequency.instant)).thenReturn(4L);
		when(alertRepository.countByIsActiveTrueAndFrequency(AlertEntity.AlertFrequency.daily)).thenReturn(3L);
		when(alertRepository.countByIsActiveTrueAndFrequency(AlertEntity.AlertFrequency.weekly)).thenReturn(2L);

		mockMvc.perform(get("/api/internal/test/email/alerts-status"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.activeAlerts").value(9))
			.andExpect(jsonPath("$.instantAlerts").value(4))
			.andExpect(jsonPath("$.dailyAlerts").value(3))
			.andExpect(jsonPath("$.weeklyAlerts").value(2));
	}
}
