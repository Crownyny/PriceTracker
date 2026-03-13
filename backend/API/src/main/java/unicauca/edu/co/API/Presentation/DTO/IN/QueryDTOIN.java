package unicauca.edu.co.API.Presentation.DTO.IN;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class QueryDTOIN {
    private String query;
    private int searchId;
    private String productRef;
    private String sources;
    private int priority; 
    //metadata?
}
