package com.miotranslate.shared.integration.publishing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.miotranslate.shared.integration.publishing.config.LanguageServicesProperties;
import com.miotranslate.shared.integration.publishing.dto.BulkImportResponse;
import com.miotranslate.shared.integration.publishing.dto.LanguageDetail;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.client.RestClientTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@RestClientTest(RestLanguageServicesClient.class)
@Import({RestLanguageServicesClient.class, RestTemplate.class})
@EnableConfigurationProperties(LanguageServicesProperties.class)
class RestLanguageServicesClientTest {

    @Autowired
    private RestLanguageServicesClient client;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private LanguageServicesProperties properties;

    @Autowired
    private ObjectMapper objectMapper;

    private MockRestServiceServer mockServer;

    @BeforeEach
    void setUp() {
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }

    @Test
    void testPushBundle_Success() throws Exception {
        String endpoint = "http://localhost:9090/multilingual/bulkImportPages";

        BulkImportResponse response = new BulkImportResponse(
                "QUICK",
                2,
                0,
                List.of(new LanguageDetail("arabic", "success", null))
        );

        mockServer.expect(requestTo(endpoint))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.domain").value("miosalon"))
                .andExpect(jsonPath("$.pageId").value("QUICK"))
                .andExpect(jsonPath("$.tags[0].tagName").value("QUICK_1"))
                .andExpect(jsonPath("$.tags[0].values.arabic").value("البيع السريع"))
                .andRespond(withSuccess(objectMapper.writeValueAsString(response), MediaType.APPLICATION_JSON));

        // Use properties via application.yml if configured, else inject manually
        // Since we didn't mock properties bean, it's auto-configured.
        // Let's set the endpoint dynamically just in case.
        properties.setDomain("miosalon");
        properties.setEndpoints(Map.of("DEV", endpoint));

        PushResult result = client.pushBundle("QUICK", "ar", "DEV", Map.of("QUICK_1", "البيع السريع"), null);

        assertTrue(result.isSuccess());
        mockServer.verify();
    }
}
