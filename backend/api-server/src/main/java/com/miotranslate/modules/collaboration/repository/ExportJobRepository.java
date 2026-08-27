package com.miotranslate.modules.collaboration.repository;

import com.miotranslate.modules.collaboration.model.ExportJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ExportJobRepository extends JpaRepository<ExportJob, UUID> {
}
