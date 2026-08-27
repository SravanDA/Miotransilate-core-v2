package com.miotranslate.modules.admin.repository;

import com.miotranslate.modules.admin.model.Language;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LanguageRepository extends JpaRepository<Language, String> {
    
    List<Language> findByStatus(String status);
}
