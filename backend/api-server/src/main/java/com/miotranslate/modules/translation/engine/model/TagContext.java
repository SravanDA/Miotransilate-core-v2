package com.miotranslate.modules.translation.engine.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TagContext {
    private String tagId;
    private String englishText;
    private int englishVersion;
}
