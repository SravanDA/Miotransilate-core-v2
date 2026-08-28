package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class RiskGate {

    public TriageResult triage(
            List<ScreenTranslationResult> results,
            ValidationOutcome validation,
            EngineConfig config,
            TranslationChunk chunk
    ) {
        List<ScreenTranslationResult> clean = new ArrayList<>();
        List<ScreenTranslationResult> flagged = new ArrayList<>();

        if (results != null) {
            for (ScreenTranslationResult result : results) {
                boolean escalate = false;
                if ("high".equalsIgnoreCase(result.getRisk())) escalate = true;
                if ("guessed".equalsIgnoreCase(result.getResolvedBy())) escalate = true;
                
                String source = getSourceText(result.getTag(), chunk);
                if (isShortAmbiguous(source, config)) escalate = true;
                
                if (hasSoftFlag(result.getTag(), validation)) escalate = true;
                if (isHighBlastRadius(source, config)) escalate = true;

                if (escalate) flagged.add(result);
                else clean.add(result);
            }
        }
        return new TriageResult(clean, flagged);
    }

    private boolean isShortAmbiguous(String source, EngineConfig config) {
        if (source == null || source.trim().isEmpty()) return false;
        String[] words = source.trim().split("\\s+");
        if (words.length <= 2 && config.getAmbiguousWordList() != null) {
            for (String ambiguous : config.getAmbiguousWordList()) {
                if (source.trim().equalsIgnoreCase(ambiguous)) return true;
            }
        }
        return false;
    }

    private boolean hasSoftFlag(String tag, ValidationOutcome validation) {
        if (validation == null || validation.getDetails() == null) return false;
        ValidationDetails details = validation.getDetails().get(tag);
        return details != null && details.getSoftFlags() != null && !details.getSoftFlags().isEmpty();
    }

    private boolean isHighBlastRadius(String source, EngineConfig config) {
        if (source == null || source.trim().isEmpty() || config.getHighBlastRadiusActions() == null) return false;
        for (String action : config.getHighBlastRadiusActions()) {
            if (source.trim().equalsIgnoreCase(action)) return true;
        }
        return false;
    }
    
    private String getSourceText(String tag, TranslationChunk chunk) {
        if (chunk == null || chunk.getTagsToTranslate() == null) return null;
        for (TagContext ctx : chunk.getTagsToTranslate()) {
            if (ctx.getTagId().equals(tag)) return ctx.getEnglishText();
        }
        return null;
    }
}
