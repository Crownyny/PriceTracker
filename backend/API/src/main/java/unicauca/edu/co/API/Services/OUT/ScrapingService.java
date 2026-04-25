package unicauca.edu.co.API.Services.OUT;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.databind.ObjectMapper;

import unicauca.edu.co.API.Domain.Model.ScrapingJobMessage;
import unicauca.edu.co.API.Presentation.DTO.Enum.ProcessStatus;
import unicauca.edu.co.API.Presentation.DTO.IN.QueryDTOIN;
import unicauca.edu.co.API.Presentation.DTO.OUT.ProcessStatusDTO;
import unicauca.edu.co.API.Services.Interfaces.OUT.IMessengerService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IScrapingService;

/**
 * Servicio de Scraping que envía queries a la cola de RabbitMQ.
 * Se encarga de publicar las solicitudes de scraping hacia el servicio de scraping.
 */
@Service
public class ScrapingService implements IScrapingService {
    
    private static final Logger logger = LoggerFactory.getLogger(ScrapingService.class);
    private static final String SCRAPING_QUEUE = "scraping.jobs";
    
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final IMessengerService messengerService;

    public ScrapingService(RabbitTemplate rabbitTemplate, ObjectMapper objectMapper, IMessengerService messengerService) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.messengerService = messengerService;   
    }

    
    @Override
    public void sendData(QueryDTOIN query) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("search_id", query.getSearch_id());
            payload.put("query", query.getQuery());
            payload.put("product_ref", query.getProduct_ref());
            payload.put("priority", 5);

            List<String> sources = parseSources(query.getSources());
            if (!sources.isEmpty()) {
                payload.put("sources", sources);
            }

            Map<String, Object> metadata = new HashMap<>();
            if (hasText(query.getSessionId())) {
                metadata.put("session_id", query.getSessionId());
            }
            payload.put("metadata", metadata);

            String queryJson = objectMapper.writeValueAsString(payload);
            publish(SCRAPING_QUEUE, queryJson, "query", query.getProduct_ref());
            ProcessStatusDTO status = new ProcessStatusDTO(ProcessStatus.SCRAPING);
            messengerService.sendProcessStatus(status, query.getProduct_ref());
        } catch (Exception e) {
            logger.error("Error al enviar query a la cola '{}': {}", SCRAPING_QUEUE, e.getMessage(), e);
            throw new RuntimeException("Error al enviar query al scraper: " + e.getMessage(), e);
        }
    }

    @Override
    public void sendScrapingJob(ScrapingJobMessage job) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("search_id", hasText(job.searchId()) ? job.searchId() : UUID.randomUUID().toString());
            payload.put("query", resolveDaemonQuery(job));
            payload.put("product_ref", job.productRef());
            payload.put("priority", job.priority());

            if (hasText(job.sourceName())) {
                payload.put("sources", List.of(job.sourceName()));
            }

            Map<String, Object> metadata = new HashMap<>();
            if (job.metadata() != null) {
                metadata.putAll(job.metadata());
            }
            if (hasText(job.sourceUrl())) {
                metadata.put("source_url", job.sourceUrl());
            }
            metadata.put("daemon_job_id", job.jobId());
            payload.put("metadata", metadata);

            String jobJson = objectMapper.writeValueAsString(payload);
            publish(SCRAPING_QUEUE, jobJson, "job", job.productRef());
        } catch (Exception e) {
            logger.error("Error al enviar ScrapingJob a la cola '{}': {}", SCRAPING_QUEUE, e.getMessage(), e);
            throw new RuntimeException("Error al enviar ScrapingJob al scraper: " + e.getMessage(), e);
        }
    }

    private String resolveDaemonQuery(ScrapingJobMessage job) {
        if (job.metadata() != null) {
            Object canonicalName = job.metadata().get("canonical_name");
            if (canonicalName instanceof String name && hasText(name)) {
                return name;
            }
        }
        if (hasText(job.productRef())) {
            return job.productRef();
        }
        return "producto";
    }

    private void publish(String queue, String payloadJson, String payloadType, String traceRef) {
        logger.info("Enviando {} a la cola '{}': {}", payloadType, queue, payloadJson);
        rabbitTemplate.convertAndSend(queue, payloadJson);
        logger.info("{} enviado exitosamente a la cola '{}' (ref={})", payloadType, queue, traceRef);
    }

    private List<String> parseSources(String rawSources) {
        if (!hasText(rawSources)) {
            return List.of();
        }

        return Stream.of(rawSources.split("[,;|]"))
            .map(String::trim)
            .filter(source -> !source.isBlank())
            .distinct()
            .toList();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }


}
