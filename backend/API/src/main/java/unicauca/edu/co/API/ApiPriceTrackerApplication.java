package unicauca.edu.co.API;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ApiPriceTrackerApplication {

	public static void main(String[] args) {
		SpringApplication.run(ApiPriceTrackerApplication.class, args);
	}

}
