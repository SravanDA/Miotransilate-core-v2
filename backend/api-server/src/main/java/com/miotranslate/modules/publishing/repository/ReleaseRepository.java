package com.miotranslate.modules.publishing.repository;

import com.miotranslate.modules.publishing.model.Release;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReleaseRepository extends JpaRepository<Release, UUID> {

    @Query("SELECT COALESCE(MAX(r.deploymentVersion), 0) FROM Release r WHERE r.pageId = :pageId AND r.languageCode = :languageCode AND r.environment = :environment")
    Integer findMaxDeploymentVersion(
            @Param("pageId") String pageId, 
            @Param("languageCode") String languageCode, 
            @Param("environment") String environment);
            
    Optional<Release> findTopByPageIdAndLanguageCodeAndEnvironmentOrderByDeploymentVersionDesc(String pageId, String languageCode, String environment);
}
