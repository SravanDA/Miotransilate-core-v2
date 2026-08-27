package com.miotranslate.modules.admin.repository;

import com.miotranslate.modules.admin.model.SystemConfiguration;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface SystemConfigurationRepository extends JpaRepository<SystemConfiguration, String> {
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM SystemConfiguration c WHERE c.configKey = :configKey")
    SystemConfiguration findByIdForUpdate(String configKey);
}
