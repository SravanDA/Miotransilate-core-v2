package com.miotranslate.modules.translation.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "translations", schema = "translation")
@IdClass(TranslationId.class)
@Getter
@Setter
public class Translation {

    @Id
    @Column(name = "tag_id", nullable = false, length = 150)
    private String tagId;

    @Id
    @Column(name = "language_code", nullable = false, length = 10)
    private String languageCode;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "NO_TRANSLATION";

    @Column(name = "current_version_number")
    private Integer currentVersionNumber;

    @Column(name = "stale_triggered_at")
    private OffsetDateTime staleTriggeredAt;

    @Column(name = "stale_triggered_by_english_ver")
    private Integer staleTriggeredByEnglishVer;

    @Column(name = "stale_prior_confirmed_ec_ver")
    private Integer stalePriorConfirmedEcVer;

    @Column(name = "stale_current_english_text")
    private String staleCurrentEnglishText;

    @Column(name = "stale_previous_english_text")
    private String stalePreviousEnglishText;

    @Version
    @Column(name = "etag_version", nullable = false)
    private Integer etagVersion = 1;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
