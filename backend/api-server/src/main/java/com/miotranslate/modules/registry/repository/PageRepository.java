package com.miotranslate.modules.registry.repository;

import com.miotranslate.modules.registry.model.Page;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PageRepository extends JpaRepository<Page, String> {
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Page p WHERE p.pageId = :pageId")
    Optional<Page> findByIdForUpdate(@Param("pageId") String pageId);
}
