package com.miotranslate.modules.migration.repository;

import com.miotranslate.modules.migration.model.ImportEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ImportEventRepository extends JpaRepository<ImportEvent, UUID> {
}
