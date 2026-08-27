package com.miotranslate.modules.reporting.api;

import com.miotranslate.modules.reporting.model.CoverageMetric;
import com.miotranslate.modules.reporting.service.ReportingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/v1")
public class ReportingController {

    private final ReportingService reportingService;

    public ReportingController(ReportingService reportingService) {
        this.reportingService = reportingService;
    }

    @GetMapping("/dashboard/coverage")
    public ResponseEntity<List<CoverageMetric>> getCoverageDashboard() {
        return ResponseEntity.ok(reportingService.getCoverageDashboard());
    }

    @GetMapping("/dashboard/languages/{code}/readiness")
    public ResponseEntity<List<CoverageMetric>> getLanguageReadiness(@PathVariable String code) {
        return ResponseEntity.ok(reportingService.getLanguageReadiness(code));
    }

    @GetMapping("/reports/stale")
    public ResponseEntity<List<Map<String, Object>>> getStaleTranslationsReport() {
        return ResponseEntity.ok(reportingService.getStaleTranslationsReport());
    }

    @GetMapping("/dashboard/pending-work")
    public ResponseEntity<Map<String, Integer>> getPendingWorkSummary() {
        return ResponseEntity.ok(reportingService.getPendingWorkSummary());
    }

    @GetMapping("/activity")
    public ResponseEntity<List<Map<String, Object>>> getActivityTimeline() {
        return ResponseEntity.ok(reportingService.getActivityTimeline());
    }

    @GetMapping("/review-queue")
    public ResponseEntity<List<Map<String, Object>>> getReviewQueue() {
        // Will use SecurityUtils to get current user and check their roles
        return ResponseEntity.ok(reportingService.getReviewQueue());
    }

    @GetMapping("/dashboard/environments")
    public ResponseEntity<List<Map<String, Object>>> getEnvironmentStatusMatrix() {
        return ResponseEntity.ok(reportingService.getEnvironmentStatusMatrix());
    }
}
