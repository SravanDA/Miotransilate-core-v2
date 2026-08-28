package com.miotranslate.shared.integration.ai.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScreenTranslationResult {
    private String tag;
    private String sense;
    private String translation;
    
    @JsonProperty("resolved_by")
    private String resolvedBy;
    
    private String risk;
    
    @JsonProperty("back_translation")
    private String backTranslation;
}
