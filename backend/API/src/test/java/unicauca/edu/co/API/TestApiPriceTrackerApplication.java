package unicauca.edu.co.API;

import org.springframework.boot.SpringApplication;

public class TestApiPriceTrackerApplication {

	public static void main(String[] args) {
		SpringApplication.from(ApiPriceTrackerApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
