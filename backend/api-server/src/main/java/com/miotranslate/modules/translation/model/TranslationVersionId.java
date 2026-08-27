package com.miotranslate.modules.translation.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.Objects;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TranslationVersionId implements Serializable {
    private String tagId;
    private String languageCode;
    private Integer versionNumber;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TranslationVersionId that = (TranslationVersionId) o;
        return Objects.equals(tagId, that.tagId) &&
               Objects.equals(languageCode, that.languageCode) &&
               Objects.equals(versionNumber, that.versionNumber);
    }

    @Override
    public int hashCode() {
        return Objects.hash(tagId, languageCode, versionNumber);
    }
}
