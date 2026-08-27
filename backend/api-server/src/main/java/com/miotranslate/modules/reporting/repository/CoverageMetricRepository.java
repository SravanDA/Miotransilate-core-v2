package com.miotranslate.modules.reporting.repository;

import com.miotranslate.modules.reporting.model.CoverageMetric;
import com.miotranslate.modules.reporting.model.CoverageMetricId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CoverageMetricRepository extends JpaRepository<CoverageMetric, CoverageMetricId> {
    
    List<CoverageMetric> findByLanguageCodeOrderByCoveragePercentageDesc(String languageCode);
}
