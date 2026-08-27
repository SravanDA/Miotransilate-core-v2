package com.miotranslate.modules.search.repository;

import com.miotranslate.modules.search.model.RecentlyEditedEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecentlyEditedEventRepository extends JpaRepository<RecentlyEditedEvent, UUID> {
    
    List<RecentlyEditedEvent> findTop30ByUserIdOrderByLastAccessedAtDesc(UUID userId);
}
