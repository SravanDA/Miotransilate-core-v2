package com.miotranslate.modules.reporting.service;

import com.miotranslate.modules.reporting.model.CoverageMetric;
import com.miotranslate.modules.reporting.repository.CoverageMetricRepository;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ReportingService {

    private final CoverageMetricRepository coverageMetricRepository;

    public ReportingService(CoverageMetricRepository coverageMetricRepository) {
        this.coverageMetricRepository = coverageMetricRepository;
    }

    public List<CoverageMetric> getCoverageDashboard() {
        return coverageMetricRepository.findAll();
    }

    public List<CoverageMetric> getLanguageReadiness(String languageCode) {
        return coverageMetricRepository.findAll().stream()
                .filter(m -> m.getLanguageCode().equals(languageCode))
                .toList();
    }

    public List<Map<String, Object>> getStaleTranslationsReport() {
        // Mock implementation for MVP
        Map<String, Object> item = new HashMap<>();
        item.put("tagId", "test_tag");
        item.put("languageCode", "es");
        item.put("status", "STALE");
        return Collections.singletonList(item);
    }

    public Map<String, Integer> getPendingWorkSummary() {
        // Mock counts
        Map<String, Integer> counts = new HashMap<>();
        counts.put("needs_ec", 12);
        counts.put("needs_translation", 45);
        counts.put("pending_review", 8);
        counts.put("stale", 3);
        counts.put("pending_publish", 5);
        return counts;
    }

    public List<Map<String, Object>> getActivityTimeline() {
        // Mock audit timeline
        Map<String, Object> item = new HashMap<>();
        item.put("actionType", "TRANSLATION_APPROVED");
        item.put("entityType", "TRANSLATION");
        item.put("timestamp", "2026-08-25T10:00:00Z");
        return Collections.singletonList(item);
    }

    public List<Map<String, Object>> getReviewQueue() {
        // Mock role detection
        // UUID userId = SecurityUtils.getCurrentUserId();
        // Assume user has ADMIN role for mocking purposes, returning both EC and Translation items
        Map<String, Object> ecItem = new HashMap<>();
        ecItem.put("type", "ENGLISH_COPY");
        ecItem.put("tagId", "test_tag_1");
        
        Map<String, Object> trItem = new HashMap<>();
        trItem.put("type", "TRANSLATION");
        trItem.put("tagId", "test_tag_2");
        trItem.put("languageCode", "fr");
        
        return List.of(ecItem, trItem);
    }

    public List<Map<String, Object>> getEnvironmentStatusMatrix() {
        // Mock environments
        Map<String, Object> dev = new HashMap<>();
        dev.put("environment", "DEV");
        dev.put("version", 5);
        
        Map<String, Object> prod = new HashMap<>();
        prod.put("environment", "PRODUCTION");
        prod.put("version", 4);
        
        return List.of(dev, prod);
    }
}
