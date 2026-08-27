package com.miotranslate.modules.content.repository;

import com.miotranslate.modules.content.model.EnglishCopy;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EnglishCopyRepository extends JpaRepository<EnglishCopy, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT ec FROM EnglishCopy ec WHERE ec.tagId = :tagId")
    Optional<EnglishCopy> findByIdForUpdate(@Param("tagId") String tagId);
}
