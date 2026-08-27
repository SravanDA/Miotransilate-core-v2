package com.miotranslate.modules.translation.repository;

import com.miotranslate.modules.translation.model.TranslationVersion;
import com.miotranslate.modules.translation.model.TranslationVersionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TranslationVersionRepository extends JpaRepository<TranslationVersion, TranslationVersionId> {
    
    List<TranslationVersion> findByTagIdAndLanguageCodeOrderByVersionNumberDesc(String tagId, String languageCode);
    
    Optional<TranslationVersion> findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(String tagId, String languageCode);
}
