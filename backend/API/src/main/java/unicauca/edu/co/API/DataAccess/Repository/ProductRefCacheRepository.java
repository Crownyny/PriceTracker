package unicauca.edu.co.API.DataAccess.Repository;

import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Repository;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

@Repository
public class ProductRefCacheRepository {
    private final Cache<String, Boolean> cache = Caffeine.newBuilder()
                .expireAfterWrite(2, TimeUnit.HOURS)
                .maximumSize(10000)
                .build();

        public void save(String productRef) {
            cache.put(productRef, true);
        }

        public boolean exists(String productRef) {
            return cache.getIfPresent(productRef) != null;
        }
}
