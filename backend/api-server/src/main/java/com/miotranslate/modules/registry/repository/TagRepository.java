package com.miotranslate.modules.registry.repository;

import com.miotranslate.modules.registry.model.Tag;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TagRepository extends JpaRepository<Tag, String> {

    List<Tag> findByPageId(String pageId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Tag t WHERE t.tagId = :tagId")
    Optional<Tag> findByIdForUpdate(@Param("tagId") String tagId);
}
