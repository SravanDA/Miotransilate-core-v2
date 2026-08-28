package com.miotranslate.modules.translation.engine.model;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class PageTranslationResult {
    private String pageId;
    private String languageCode;
    private String status; // COMPLETE, PARTIAL_SUCCESS, FAILED
    private int requested;
    private int succeeded;
    private int blocked;
    private int remaining;
    private List<String> remainingTagIds;
    private ChunkStats chunks;
    private List<EngineResult> results;
    
    @Data
    @Builder
    public static class ChunkStats {
        private int total;
        private int succeeded;
        private int retried;
        private int reconciliationRuns;
    }
}
