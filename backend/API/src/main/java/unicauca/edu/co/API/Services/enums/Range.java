package unicauca.edu.co.API.Services.enums;

import java.time.LocalDateTime;

public enum Range {

    W1(7),
    W3(21),
    W12(90),
    ALL(0);

    private final int days;

    Range(int days) {
        this.days = days;
    }
    public LocalDateTime toDate() {
        if (this == ALL) return null;
        return LocalDateTime.now().minusDays(days);
    }
    public boolean isAll() {return this == ALL;}
}