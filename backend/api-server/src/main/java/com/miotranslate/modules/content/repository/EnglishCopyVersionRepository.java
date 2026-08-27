package com.miotranslate.modules.content.repository;

import com.miotranslate.modules.content.model.EnglishCopyVersion;
import com.miotranslate.modules.content.model.EnglishCopyVersionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EnglishCopyVersionRepository extends JpaRepository<EnglishCopyVersion, EnglishCopyVersionId> {
    
    List<EnglishCopyVersion> findByTagIdOrderByVersionNumberDesc(String tagId);
    
    Optional<EnglishCopyVersion> findTopByTagIdOrderByVersionNumberDesc(String tagId);
}
