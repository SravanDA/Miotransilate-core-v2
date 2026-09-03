package com.miotranslate.modules.migration.api;

import com.miotranslate.modules.migration.model.ImportEvent;
import com.miotranslate.modules.migration.model.MigrationRowEvent;
import com.miotranslate.modules.migration.repository.ImportEventRepository;
import com.miotranslate.modules.migration.repository.MigrationRowEventRepository;
import com.miotranslate.modules.migration.service.MigrationService;
import com.miotranslate.shared.auth.RequiresPermission;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/migrations")
@RequiresPermission("ADMIN_MIGRATION")
public class MigrationController {

    private final MigrationService migrationService;
    private final ImportEventRepository importEventRepository;
    private final MigrationRowEventRepository migrationRowEventRepository;

    public MigrationController(MigrationService migrationService,
                               ImportEventRepository importEventRepository,
                               MigrationRowEventRepository migrationRowEventRepository) {
        this.migrationService = migrationService;
        this.importEventRepository = importEventRepository;
        this.migrationRowEventRepository = migrationRowEventRepository;
    }

    @PostMapping
    public ResponseEntity<ImportEvent> uploadImportFile(@RequestParam("file") MultipartFile file) {
        UUID userId = SecurityUtils.getCurrentUserId();
        String filename = file.getOriginalFilename();
        long sizeBytes = file.getSize();
        
        ImportEvent event = migrationService.uploadImportFile(filename, sizeBytes, userId);
        
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(event);
    }

    @PostMapping("/{id}/execute")
    public ResponseEntity<Void> executeMigrationImport(@PathVariable UUID id) {
        migrationService.executeMigrationImport(id);
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ImportEvent> getImportStatus(@PathVariable UUID id) {
        return importEventRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/{id}/report")
    public ResponseEntity<List<MigrationRowEvent>> getMigrationValidationReport(@PathVariable UUID id) {
        return ResponseEntity.ok(migrationRowEventRepository.findByImportEventIdOrderBySourceRowNumberAsc(id));
    }

    @DeleteMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetDataDelete() {
        return ResponseEntity.ok(migrationService.deleteAllMigratedData());
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetDataPost() {
        return ResponseEntity.ok(migrationService.deleteAllMigratedData());
    }

    @DeleteMapping("/all-data")
    public ResponseEntity<Map<String, Object>> deleteAllData() {
        return ResponseEntity.ok(migrationService.deleteAllMigratedData());
    }
}
