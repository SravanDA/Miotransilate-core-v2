package com.miotranslate.shared.integration.publishing.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Data
@Configuration
@ConfigurationProperties(prefix = "miotranslate.language-services")
public class LanguageServicesProperties {
    private String domain;
    private Map<String, String> endpoints;
}
