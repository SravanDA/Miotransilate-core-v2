package com.miotranslate.modules.translation.engine.model;

import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import lombok.Builder;
import lombok.Data;

/**
 * Result of processing a single tag through the translation engine.
 * 
 * Carries all signals from the pipeline:
 * - rawResult: the model's output
 * - validationDetails: deterministic validation results
 * - isBlocked: failed a hard validation gate (placeholder/markup)
 * - isFlagged: triage flagged for review (P0-4 fix: RiskGate result is now consumed)
 * - sense, resolvedBy, risk: model output signals (P1-2: now carried through for persistence)
 * - stateCause: reason for blocking or flagging
 * - triageCause: specific triage trigger (for audit/diagnostics)
 * - modelUsed: which model produced this result
 */
@Data
@Builder
public class EngineResult {
    private String tagId;
    private ScreenTranslationResult rawResult;
    private ValidationDetails validationDetails;
    private String stateCause;
    private boolean isBlocked;      // Failed placeholder/markup hard gate
    
    // P0-4 fix: triage result is now wired through
    private boolean isFlagged;      // RiskGate flagged for review
    private String triageCause;     // Why it was flagged: "high_risk", "guessed", "short_ambiguous", etc.
    
    // P1-2 fix: model output signals carried through for persistence
    private String sense;           // Model's interpretation of the source string
    private String resolvedBy;      // How the model resolved ambiguity
    private String risk;            // Model's self-assessed risk level
    private String modelUsed;       // Which model produced this translation
}
