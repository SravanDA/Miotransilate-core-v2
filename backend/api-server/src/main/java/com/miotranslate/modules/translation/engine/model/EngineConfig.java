package com.miotranslate.modules.translation.engine.model;

import lombok.Data;

import java.util.List;

@Data
public class EngineConfig {
    private List<String> ambiguousWordList = List.of(
            "Save", "Female", "Male", "Due", "Tip", "Close", "Open", "Book", 
            "Service", "Balance", "Post", "Draft", "Back", "Next", "Apply"
    );
    private List<String> highBlastRadiusActions = List.of(
            "Delete", "Cancel", "Reset", "Refund", "Void", "Terminate", "Remove", "Purge"
    );
    private int maxRetries = 2;
    private long backoffBaseMs = 1000;
    private long backoffMaxMs = 60000;
    private long requestTimeoutMs = 30000;
    private int maxParallelism = 4; // Fix 12: Concurrent chunk translation
}
