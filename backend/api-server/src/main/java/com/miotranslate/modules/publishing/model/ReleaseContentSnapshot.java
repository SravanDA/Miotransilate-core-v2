package com.miotranslate.modules.publishing.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "release_content_snapshots", schema = "publishing")
@IdClass(ReleaseContentSnapshotId.class)
@Getter
@Setter
public class ReleaseContentSnapshot {

    @Id
    @Column(name = "release_id", nullable = false)
    private UUID releaseId;

    @Id
    @Column(name = "tag_id", nullable = false, length = 150)
    private String tagId;

    @Column(name = "translation_version_number", nullable = false)
    private Integer translationVersionNumber;

    @Column(name = "source_english_version_number", nullable = false)
    private Integer sourceEnglishVersionNumber;

    @Column(name = "translation_text", nullable = false)
    private String translationText;
}
