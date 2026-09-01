package com.miotranslate.shared.integration.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@Primary
@RequiredArgsConstructor
public class GeminiTranslationClient implements AiTranslationClient {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${miotranslate.gemini.api-key:}")
    private String apiKey;

    @Value("${miotranslate.gemini.model:gemini-2.5-flash}")
    private String model;

    /**
     * Response schema for structured JSON output.
     * P1-5 fix: Using Gemini's responseMimeType + responseSchema eliminates the need for
     * fragile JSON recovery strategies (fence stripping, regex extraction, field-name roulette).
     * The model emits conforming JSON structurally — no fences, no wrapper keys.
     * 
     * P1-4 fix: thinkingBudget is set to 0 because translation of short UI strings
     * does not benefit from extended reasoning, and thinking tokens count against maxOutputTokens.
     */
    private static final String RESPONSE_SCHEMA = """
            {
              "type": "ARRAY",
              "items": {
                "type": "OBJECT",
                "properties": {
                  "tag": { "type": "STRING", "description": "The tag ID from the request" },
                  "translation": { "type": "STRING", "description": "Translated text in target language" },
                  "back_translation": { "type": "STRING", "description": "Literal English back-translation" },
                  "sense": { "type": "STRING", "description": "Brief explanation of how the source was interpreted" },
                  "resolved_by": {
                    "type": "STRING",
                    "enum": ["siblings", "tag_id", "page", "domain", "unambiguous", "guessed"],
                    "description": "Which context source resolved ambiguity"
                  },
                  "risk": {
                    "type": "STRING",
                    "enum": ["low", "medium", "high"],
                    "description": "Self-assessed translation risk"
                  }
                },
                "required": ["tag", "translation", "back_translation", "sense", "resolved_by", "risk"]
              }
            }
            """;

    @Override
    public List<ScreenTranslationResult> translateScreen(String prompt) {
        log.info("Sending prompt to Gemini model: {}", model);
        
        if (apiKey == null || apiKey.isEmpty()) {
            log.warn("Gemini API key is not configured. Returning empty translation result.");
            return new ArrayList<>();
        }

        try {
            String systemInstruction = "You are a professional translator for MioSalon. "
                    + "Given the following JSON context containing a targetLanguage and tagsToTranslate, "
                    + "translate all strings. For each tag, determine how you resolved ambiguity "
                    + "(from siblings, tag_id, page context, domain knowledge, unambiguous text, or guessing) "
                    + "and assess translation risk (low/medium/high). "
                    + "The 'sense' field must explain your interpretation before you translate — "
                    + "e.g. 'Gender option for a customer record' for 'Female'.";

            String fullText = systemInstruction + "\n\n" + prompt;

            // P1-4 + P1-5 fix: structured output with thinkingBudget: 0 and explicit maxOutputTokens
            String requestBody = """
                {
                  "contents": [
                    {
                      "parts": [
                        {
                          "text": %s
                        }
                      ]
                    }
                  ],
                  "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 16384,
                    "responseMimeType": "application/json",
                    "responseSchema": %s,
                    "thinkingConfig": {
                      "thinkingBudget": 0
                    }
                  }
                }
                """.formatted(objectMapper.writeValueAsString(fullText), RESPONSE_SCHEMA);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(60))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                log.error("Gemini API error ({}): {}", response.statusCode(), response.body());
                throw new RuntimeException("Failed to call Gemini API: " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            
            // P2-6 fix: handle promptFeedback / safety blocks
            JsonNode promptFeedback = root.path("promptFeedback");
            if (promptFeedback.has("blockReason")) {
                String blockReason = promptFeedback.get("blockReason").asText();
                log.error("Gemini blocked the prompt: {}", blockReason);
                throw new RuntimeException("Prompt blocked by safety filter: " + blockReason);
            }
            
            JsonNode candidates = root.path("candidates");
            if (!candidates.isArray() || candidates.isEmpty()) {
                log.error("Gemini returned no candidates. Response: {}", response.body());
                throw new RuntimeException("Gemini returned no candidates");
            }
            
            // P1-4 fix: detect MAX_TOKENS truncation
            String finishReason = candidates.get(0).path("finishReason").asText("");
            if ("MAX_TOKENS".equals(finishReason)) {
                log.error("Gemini response truncated (MAX_TOKENS). Response may be incomplete.");
                throw new RuntimeException("Gemini response truncated — increase maxOutputTokens or reduce chunk size");
            }
            
            // With responseMimeType: "application/json", the response is clean JSON — no fences to strip
            StringBuilder responseBuilder = new StringBuilder();
            JsonNode partsNode = root.at("/candidates/0/content/parts");
            if (partsNode.isArray()) {
                for (JsonNode part : partsNode) {
                    if (part.has("text") && !part.path("thought").asBoolean(false)) {
                        responseBuilder.append(part.get("text").asText());
                    }
                }
            }
            
            String responseText = responseBuilder.toString().trim();
            if (responseText.isEmpty()) {
                JsonNode singleText = root.at("/candidates/0/content/parts/0/text");
                if (!singleText.isMissingNode()) {
                    responseText = singleText.asText().trim();
                }
            }

            // With structured output, direct parse should work. No need for regex extraction.
            List<ScreenTranslationResult> results = objectMapper.readValue(responseText, new TypeReference<>() {});
            return results;

        } catch (Exception e) {
            log.error("Exception while translating with Gemini: ", e);
            throw new RuntimeException("Translation failed", e);
        }
    }

    private static final String AUDIT_RESPONSE_SCHEMA = """
            {
              "type": "ARRAY",
              "items": {
                "type": "OBJECT",
                "properties": {
                  "tag": { "type": "STRING", "description": "The tag ID" },
                  "verdict": {
                    "type": "STRING",
                    "enum": ["correct", "wrong_sense", "wrong_register", "awkward", "unsure"],
                    "description": "Verification outcome"
                  },
                  "reading": { "type": "STRING", "description": "How a native reader interprets the string in English" },
                  "better": { "type": "STRING", "description": "Improved translation if verdict is not correct, or empty/null" }
                },
                "required": ["tag", "verdict", "reading"]
              }
            }
            """;

    @Override
    public List<com.miotranslate.shared.integration.ai.model.AuditResultItem> auditScreen(String prompt) {
        log.info("Sending audit prompt to Gemini model: {}", model);
        
        if (apiKey == null || apiKey.isEmpty()) {
            log.warn("Gemini API key not configured for audit. Returning empty result.");
            return new ArrayList<>();
        }
        
        try {
            String requestBody = """
                {
                  "contents": [
                    {
                      "parts": [
                        {
                          "text": %s
                        }
                      ]
                    }
                  ],
                  "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 8192,
                    "responseMimeType": "application/json",
                    "responseSchema": %s,
                    "thinkingConfig": {
                      "thinkingBudget": 0
                    }
                  }
                }
                """.formatted(objectMapper.writeValueAsString(prompt), AUDIT_RESPONSE_SCHEMA);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                log.error("Gemini audit API error ({}): {}", response.statusCode(), response.body());
                return new ArrayList<>();
            }

            JsonNode root = objectMapper.readTree(response.body());
            StringBuilder responseBuilder = new StringBuilder();
            JsonNode partsNode = root.at("/candidates/0/content/parts");
            if (partsNode.isArray()) {
                for (JsonNode part : partsNode) {
                    if (part.has("text") && !part.path("thought").asBoolean(false)) {
                        responseBuilder.append(part.get("text").asText());
                    }
                }
            }
            String responseText = responseBuilder.toString().trim();
            if (responseText.isEmpty()) {
                JsonNode singleText = root.at("/candidates/0/content/parts/0/text");
                if (!singleText.isMissingNode()) {
                    responseText = singleText.asText().trim();
                }
            }

            return objectMapper.readValue(responseText, new TypeReference<List<com.miotranslate.shared.integration.ai.model.AuditResultItem>>() {});
        } catch (Exception e) {
            log.error("Audit call failed: ", e);
            return new ArrayList<>();
        }
    }
}
