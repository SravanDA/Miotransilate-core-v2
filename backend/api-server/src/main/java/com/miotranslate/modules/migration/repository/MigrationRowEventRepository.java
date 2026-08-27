package com.miotranslate.modules.migration.repository;

import com.miotranslate.modules.migration.model.MigrationRowEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MigrationRowEventRepository extends JpaRepository<MigrationRowEvent, UUID> {
    
    List<MigrationRowEvent> findByImportEventIdOrderBySourceRowNumberAsc(UUID importEventId);
}
