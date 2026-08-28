package com.miotranslate.modules.translation.engine.model;

import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class EngineResult {
    private String tagId;
    private ScreenTranslationResult rawResult;
    private ValidationDetails validationDetails;
    private String stateCause; 
    private boolean isBlocked; // Failed placeholder check
}
