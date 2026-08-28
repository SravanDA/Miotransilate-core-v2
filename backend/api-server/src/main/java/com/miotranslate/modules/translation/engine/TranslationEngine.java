package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class TranslationEngine {
    
    private final ContextAssembler contextAssembler;
    private final BatchRunner batchRunner;
    
    public PageTranslationResult translatePage(String pageId, String targetLanguage, Set<String> specificTagIds, EngineConfig config) {
        PageJob job = contextAssembler.assemble(pageId, targetLanguage, specificTagIds);
        return batchRunner.translatePage(job, config);
    }
}
