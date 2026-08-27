package com.miotranslate.modules.content.model;

import java.io.Serializable;
import java.util.Objects;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EnglishCopyVersionId implements Serializable {
    private String tagId;
    private Integer versionNumber;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        EnglishCopyVersionId that = (EnglishCopyVersionId) o;
        return Objects.equals(tagId, that.tagId) &&
               Objects.equals(versionNumber, that.versionNumber);
    }

    @Override
    public int hashCode() {
        return Objects.hash(tagId, versionNumber);
    }
}
