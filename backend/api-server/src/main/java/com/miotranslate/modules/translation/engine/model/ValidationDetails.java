package com.miotranslate.modules.translation.engine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationDetails {
    private String tagId;
    private boolean passed;
    private String failureReason; // "FAILED_PLACEHOLDER", "FAILED_MARKUP"
    private List<String> softFlags; // "needs_attention_length", "needs_attention_untranslated"
    private String fixedTranslation; // If space was trimmed, updated translation
}
