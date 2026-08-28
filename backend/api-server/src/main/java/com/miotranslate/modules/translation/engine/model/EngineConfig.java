package com.miotranslate.modules.translation.engine.model;

import lombok.Data;

import java.util.List;

@Data
public class EngineConfig {
    private List<String> ambiguousWordList;
    private List<String> highBlastRadiusActions;
    private int maxRetries = 2;
    private long backoffBaseMs = 1000;
    private long backoffMaxMs = 60000;
    private long requestTimeoutMs = 30000;
    private int maxParallelism = 1;
}
