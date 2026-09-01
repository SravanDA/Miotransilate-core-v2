package com.miotranslate.modules.translation.repository;

import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.model.TranslationId;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TranslationRepository extends JpaRepository<Translation, TranslationId> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Translation t WHERE t.tagId = :tagId AND t.languageCode = :languageCode")
    Optional<Translation> findByIdForUpdate(@Param("tagId") String tagId, @Param("languageCode") String languageCode);

    List<Translation> findByTagIdInAndLanguageCode(java.util.Collection<String> tagIds, String languageCode);
}
