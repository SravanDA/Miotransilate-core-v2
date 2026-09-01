package com.miotranslate.modules.translation.engine.model;

import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ModelOutputValidation {
    private List<ScreenTranslationResult> validResults;
    private Set<String> rejectedTagIds;
    private Set<String> missingTagIds;
}
