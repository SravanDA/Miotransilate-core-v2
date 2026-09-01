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

    @Override
    public List<ScreenTranslationResult> translateScreen(String prompt) {
        log.info("Sending prompt to Gemini: {}", prompt);
        
        if (apiKey == null || apiKey.isEmpty()) {
            log.warn("Gemini API key is not configured. Returning empty translation result.");
            return new ArrayList<>();
        }

        try {
            String systemInstruction = "You are a professional translator for MioSalon. "
                    + "Given the following JSON context containing a targetLanguage and tagsToTranslate, "
                    + "translate all strings. Output MUST be ONLY a valid JSON array of objects with the exact keys: "
                    + "tag (string, matching tagId), translation (string), back_translation (string), "
                    + "sense (string, explanation of context), risk (string, LOW/MEDIUM/HIGH). No markdown blocks.";

            String fullText = systemInstruction + "\n\n" + prompt;

            // Build Gemini request payload
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
                    "topP": 0.8
                  }
                }
                """.formatted(objectMapper.writeValueAsString(fullText));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                log.error("Gemini API error ({}): {}", response.statusCode(), response.body());
                throw new RuntimeException("Failed to call Gemini API: " + response.statusCode());
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
            
            // Clean up possible markdown or extract JSON array
            int startBracket = responseText.indexOf('[');
            int endBracket = responseText.lastIndexOf(']');
            if (startBracket != -1 && endBracket != -1 && endBracket > startBracket) {
                responseText = responseText.substring(startBracket, endBracket + 1);
            } else {
                if (responseText.startsWith("```json")) responseText = responseText.substring(7);
                if (responseText.startsWith("```")) responseText = responseText.substring(3);
                if (responseText.endsWith("```")) responseText = responseText.substring(0, responseText.length() - 3);
                responseText = responseText.trim();
            }

            List<ScreenTranslationResult> results = objectMapper.readValue(responseText, new TypeReference<>() {});
            return results;

        } catch (Exception e) {
            log.error("Exception while translating with Gemini: ", e);
            throw new RuntimeException("Translation failed", e);
        }
    }

    @Override
    public String auditScreen(String prompt) {
        log.info("Sending audit prompt to Gemini: {}", prompt);
        return "{}";
    }
}
