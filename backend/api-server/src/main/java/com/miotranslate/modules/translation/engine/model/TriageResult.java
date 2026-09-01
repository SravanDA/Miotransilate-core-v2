package com.miotranslate.modules.translation.engine.model;

import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TriageResult {
    private List<ScreenTranslationResult> clean;
    private List<ScreenTranslationResult> flagged;
}
