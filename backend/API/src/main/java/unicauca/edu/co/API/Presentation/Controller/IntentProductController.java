package unicauca.edu.co.API.Presentation.Controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import unicauca.edu.co.API.Presentation.DTO.ModelQueryDTO;
import unicauca.edu.co.API.Presentation.DTO.IN.IntentResponseDTOIN;
import unicauca.edu.co.API.Services.Interfaces.OUT.IIntentProductService;
import unicauca.edu.co.API.Services.OUT.IntentProductService;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


@RestController
@RequestMapping("/api/intent")
public class IntentProductController {

    private final IIntentProductService intentProductService;

    public IntentProductController(IntentProductService intentProductService) {
        this.intentProductService = intentProductService;
    }

    @PostMapping("intent")
    public IntentResponseDTOIN getIntentPredict(@RequestBody ModelQueryDTO param) {
        return intentProductService.getIntentResponse(param).block();
    }

}
