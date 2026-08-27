package com.miotranslate.shared.integration.publishing;

import com.miotranslate.shared.integration.publishing.config.LanguageServicesProperties;
import com.miotranslate.shared.integration.publishing.dto.BulkImportRequest;
import com.miotranslate.shared.integration.publishing.dto.BulkImportResponse;
import com.miotranslate.shared.integration.publishing.dto.LanguageDetail;
import com.miotranslate.shared.integration.publishing.dto.TagData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@Primary
@Profile("!mock")
@RequiredArgsConstructor
public class RestLanguageServicesClient implements LanguageServicesClient {

    private final RestTemplate restTemplate;
    private final LanguageServicesProperties properties;

    @Override
    public PushResult pushBundle(String pageId, String languageCode, String environment, Map<String, String> tags, List<String> removeTags) {
        // 1. Get endpoint for environment
        String endpoint = properties.getEndpoints().get(environment);
        if (endpoint == null) {
            log.error("No Language Services endpoint configured for environment: {}", environment);
            return new PushResult(false, "No endpoint configured for environment: " + environment, 500);
        }

        // 2. Map language code
        String lsLanguageCode = mapLanguageCode(languageCode);

        // 3. Construct payload
        List<TagData> tagDataList = new ArrayList<>();
        tags.forEach((tagId, translatedText) -> {
            TagData data = new TagData(tagId, Map.of(lsLanguageCode, translatedText));
            tagDataList.add(data);
        });

        BulkImportRequest request = BulkImportRequest.builder()
                .domain(properties.getDomain())
                .pageId(pageId)
                // For now, pageName is omitted or passed as pageId if not available in context
                .pageName(pageId) 
                .tags(tagDataList)
                .removeTags(removeTags)
                .build();

        // 4. Send Request
        try {
            log.debug("Sending BulkImportRequest to {} for environment {}", endpoint, environment);
            ResponseEntity<BulkImportResponse> responseEntity = restTemplate.postForEntity(
                    endpoint, 
                    request, 
                    BulkImportResponse.class
            );

            BulkImportResponse response = responseEntity.getBody();
            if (response == null) {
                return new PushResult(false, "Empty response from Language Services", responseEntity.getStatusCode().value());
            }

            // 5. Check response for target language success
            boolean success = false;
            String payloadSummary = "Processed: " + response.getProcessed() + ", Failed: " + response.getFailed();
            
            if (response.getDetails() != null) {
                for (LanguageDetail detail : response.getDetails()) {
                    if (lsLanguageCode.equals(detail.getLanguage())) {
                        if ("success".equalsIgnoreCase(detail.getStatus())) {
                            success = true;
                        } else {
                            payloadSummary += " | Reason: " + detail.getReason();
                        }
                        break;
                    }
                }
            } else if (response.getProcessed() > 0 && response.getFailed() == 0) {
                // Fallback if details are missing but it succeeded
                success = true;
            }

            return new PushResult(success, payloadSummary, responseEntity.getStatusCode().value());

        } catch (Exception e) {
            log.error("Failed to push bundle to Language Services: {}", e.getMessage(), e);
            return new PushResult(false, "Exception: " + e.getMessage(), 500);
        }
    }

    private String mapLanguageCode(String isoCode) {
        if (isoCode == null) return "unknown";
        return switch (isoCode.toLowerCase()) {
            case "en" -> "eng";
            case "ar" -> "arabic";
            case "bg" -> "bulgarian";
            case "it" -> "italian";
            case "fr-ca" -> "french";
            case "es" -> "spanish";
            case "de" -> "german";
            case "tr" -> "turkish";
            default -> isoCode.toLowerCase();
        };
    }
}
