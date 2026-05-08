package unicauca.edu.co.API;

import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootConfiguration
@EnableAutoConfiguration
@EntityScan(basePackages = "unicauca.edu.co.API.DataAccess.Entity")
@EnableJpaRepositories(basePackages = "unicauca.edu.co.API.DataAccess.Repository")
public class ScenarioTestApplication {
}
