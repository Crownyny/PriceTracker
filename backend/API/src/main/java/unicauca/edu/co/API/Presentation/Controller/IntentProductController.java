package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import unicauca.edu.co.API.Services.IN.IntentProductService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
@RequestMapping("/api/intent")
public class IntentProductController {

    private final IntentProductService intentProductService;

    public IntentProductController(IntentProductService intentProductService) {
        this.intentProductService = intentProductService;
    }

    @PostMapping("intent")
    public String getMethodName(@RequestParam String param) {
        return intentProductService.getIntentResponse(param).block().getIntent();
    }

}
