package com.miotranslate.modules.migration.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "migration_row_events", schema = "migration")
@Getter
@Setter
public class MigrationRowEvent {

    @Id
    @Column(name = "row_event_id", nullable = false)
    private UUID rowEventId = UUID.randomUUID();

    @Column(name = "import_event_id", nullable = false)
    private UUID importEventId;

    @Column(name = "source_row_number", nullable = false)
    private Integer sourceRowNumber;

    @Column(name = "source_page_id", length = 100)
    private String sourcePageId;

    @Column(name = "source_tag_id", length = 150)
    private String sourceTagId;

    @Column(name = "source_language_code", length = 10)
    private String sourceLanguageCode;

    @Column(name = "event_type", nullable = false, length = 10)
    private String eventType = "SKIPPED"; // IMPORTED, SKIPPED, FAILED

    @Column(name = "reason_code", nullable = false, length = 60)
    private String reasonCode;

    @Column(name = "reason_detail")
    private String reasonDetail;

    @CreationTimestamp
    @Column(name = "recorded_at", nullable = false, updatable = false)
    private OffsetDateTime recordedAt = OffsetDateTime.now();
}
