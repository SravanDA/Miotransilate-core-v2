package com.miotranslate.modules.search.repository;

import com.miotranslate.modules.search.model.Bookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BookmarkRepository extends JpaRepository<Bookmark, UUID> {
    
    List<Bookmark> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
