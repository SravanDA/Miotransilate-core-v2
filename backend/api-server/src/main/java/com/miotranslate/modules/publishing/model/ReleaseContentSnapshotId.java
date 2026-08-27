package com.miotranslate.modules.publishing.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ReleaseContentSnapshotId implements Serializable {
    private UUID releaseId;
    private String tagId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ReleaseContentSnapshotId that = (ReleaseContentSnapshotId) o;
        return Objects.equals(releaseId, that.releaseId) &&
               Objects.equals(tagId, that.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(releaseId, tagId);
    }
}
